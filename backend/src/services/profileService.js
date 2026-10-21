const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { fromJson, toJson } = require('../utils/helpers');
const audit = require('./auditService');
const notify = require('./notificationService');

const COLLEGE_JOIN = 'LEFT JOIN dict_item d ON d.type=\'COLLEGE\' AND d.code = p.college_code';
const MAJOR_JOIN = 'LEFT JOIN dict_item m ON m.type=\'MAJOR\' AND m.code = p.major_code';

function normalizeProfile(p) {
  if (!p) return p;
  p.skills = fromJson(p.skills);
  return p;
}

// ---------- 本人档案 ----------
async function getMyProfile(accountId) {
  const [acc] = await pool.query('SELECT * FROM account WHERE id=?', [accountId]);
  if (!acc[0]) throw new AppError(404, 'NOT_FOUND', '账号不存在');
  const [rows] = await pool.query('SELECT * FROM user_profile WHERE account_id=?', [accountId]);
  return normalizeProfile(rows[0] || null);
}

const STUDENT_FIELDS = ['real_name', 'gender', 'college_code', 'major_code', 'class_name', 'enrollment_year', 'graduation_year', 'degree_level', 'bio', 'skills', 'looking_for_team', 'allow_teacher_invite', 'avatar_url', 'email_public'];
const TEACHER_FIELDS = ['real_name', 'gender', 'college_code', 'title', 'research_fields', 'bio', 'accept_students', 'max_teams', 'avatar_url', 'email_public', 'homepage_url'];

async function updateMyProfile(accountId, fields) {
  const [accRows] = await pool.query('SELECT user_type FROM account WHERE id=?', [accountId]);
  if (!accRows[0]) throw new AppError(404, 'NOT_FOUND', '账号不存在');
  const userType = accRows[0].user_type;
  const allowed = userType === 'STUDENT' ? STUDENT_FIELDS : TEACHER_FIELDS;

  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    if (key === 'skills' || key === 'max_teams' || key === 'looking_for_team' || key === 'allow_teacher_invite' || key === 'accept_students') {
      sets.push(`${key}=?`);
      values.push(toJson(fields[key]));
    } else {
      sets.push(`${key}=?`);
      values.push(fields[key]);
    }
  }
  if (!sets.length) throw new AppError(400, 'VALIDATION', '没有可更新的字段');
  sets.push('profile_completed=1');
  values.push(accountId);
  await pool.query(`UPDATE user_profile SET ${sets.join(', ')} WHERE account_id=?`, values);

  // 同步姓名冗余到 account
  if (fields.real_name) {
    await pool.query('UPDATE account SET display_name=? WHERE id=?', [fields.real_name, accountId]);
  }
  return getMyProfile(accountId);
}

// ---------- 身份认证 ----------
async function submitVerification(accountId, { materials }) {
  const [accRows] = await pool.query('SELECT user_type FROM account WHERE id=?', [accountId]);
  if (!accRows[0]) throw new AppError(404, 'NOT_FOUND', '账号不存在');
  const userType = accRows[0].user_type;

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO user_verification (account_id, user_type, status, materials, created_at)
       VALUES (?,?,?,?,NOW(3))
       ON DUPLICATE KEY UPDATE status='PENDING_REVIEW', materials=VALUES(materials), reason=NULL, reviewed_at=NULL, reviewer_id=NULL`,
      [accountId, userType, 'PENDING_REVIEW', toJson(materials || [])]
    );
    await conn.query("UPDATE account SET verify_status='PENDING_REVIEW' WHERE id=?", [accountId]);
  });
  await audit.log({ operator_id: accountId, action: 'VERIFICATION_SUBMIT', module: 'user', detail: { userType } });
  return getMyVerification(accountId);
}

async function getMyVerification(accountId) {
  const [rows] = await pool.query('SELECT * FROM user_verification WHERE account_id=?', [accountId]);
  const v = rows[0] || null;
  if (v) v.materials = fromJson(v.materials);
  return v;
}

// ---------- 教师公开检索 ----------
async function listTeachers({ keyword, collegeCode, page, size, offset }) {
  const where = ["p.user_type='TEACHER'"];
  const params = [];
  if (keyword) { where.push('(p.real_name LIKE ? OR p.research_fields LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (collegeCode) { where.push('p.college_code=?'); params.push(collegeCode); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM user_profile p WHERE ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT p.account_id, p.real_name, p.college_code, d.label AS college_name, p.title, p.research_fields, p.bio,
            p.accept_students, p.max_teams, p.avatar_url, p.email_public, p.homepage_url
     FROM user_profile p ${COLLEGE_JOIN} WHERE ${w}
     ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
}

async function getTeacherPublic(accountId) {
  const [rows] = await pool.query(
    `SELECT p.account_id, p.user_type, p.real_name, p.college_code, d.label AS college_name, p.title,
            p.research_fields, p.bio, p.accept_students, p.max_teams, p.avatar_url, p.email_public, p.homepage_url
     FROM user_profile p ${COLLEGE_JOIN} WHERE p.account_id=? AND p.user_type='TEACHER'`,
    [accountId]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', '教师不存在');
  return rows[0];
}

// ---------- 学生检索（老师挑人） ----------
async function searchStudents({ keyword, collegeCode, degreeLevel, skill, page, size, offset }) {
  const where = ["p.user_type='STUDENT'"];
  const params = [];
  if (keyword) { where.push('(p.real_name LIKE ? OR p.student_no LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (collegeCode) { where.push('p.college_code=?'); params.push(collegeCode); }
  if (degreeLevel) { where.push('p.degree_level=?'); params.push(degreeLevel); }
  if (skill) { where.push("JSON_CONTAINS(p.skills, ?)"); params.push(JSON.stringify(skill)); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM user_profile p WHERE ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT p.account_id, p.real_name, p.college_code, d.label AS college_name, p.major_code, m.label AS major_name,
            p.class_name, p.degree_level, p.enrollment_year, p.skills, p.looking_for_team, p.allow_teacher_invite, p.avatar_url, p.bio
     FROM user_profile p ${COLLEGE_JOIN} ${MAJOR_JOIN} WHERE ${w}
     ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows.map(normalizeProfile), total };
}

async function getStudentDetail(accountId) {
  const [rows] = await pool.query(
    `SELECT p.account_id, p.user_type, p.real_name, p.student_no, p.college_code, d.label AS college_name,
            p.major_code, m.label AS major_name, p.class_name, p.degree_level, p.enrollment_year,
            p.graduation_year, p.skills, p.looking_for_team, p.allow_teacher_invite, p.avatar_url, p.bio
     FROM user_profile p ${COLLEGE_JOIN} ${MAJOR_JOIN} WHERE p.account_id=? AND p.user_type='STUDENT'`,
    [accountId]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', '学生不存在');
  return normalizeProfile(rows[0]);
}

// 学生公开主页（未登录可访问，仅白名单字段）
async function getStudentPublic(accountId) {
  const [rows] = await pool.query(
    `SELECT p.account_id, p.real_name, p.college_code, d.label AS college_name, p.major_code, m.label AS major_name,
            p.degree_level, p.enrollment_year, p.skills, p.bio, p.avatar_url
     FROM user_profile p ${COLLEGE_JOIN} ${MAJOR_JOIN} WHERE p.account_id=? AND p.user_type='STUDENT'`,
    [accountId]
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', '学生不存在');
  return normalizeProfile(rows[0]);
}

module.exports = {
  getMyProfile, updateMyProfile, submitVerification, getMyVerification,
  listTeachers, getTeacherPublic, searchStudents, getStudentDetail, getStudentPublic,
};
