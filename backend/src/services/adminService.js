const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { hash } = require('../utils/password');
const { fromJson, toJson } = require('../utils/helpers');
const accountService = require('./accountService');
const audit = require('./auditService');
const notify = require('./notificationService');

// ---------- 用户管理 ----------
async function listUsers({ keyword, userType, status, page, size, offset }) {
  const where = [];
  const params = [];
  if (keyword) { where.push('(a.username LIKE ? OR a.display_name LIKE ? OR p.real_name LIKE ? OR p.student_no LIKE ? OR p.teacher_no LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (userType) { where.push('a.user_type=?'); params.push(userType); }
  if (status) { where.push('a.status=?'); params.push(status); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [cnt] = await pool.query(
    `SELECT COUNT(*) c FROM account a LEFT JOIN user_profile p ON p.account_id=a.id ${w}`, params
  );
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT a.id, a.username, a.user_type, a.display_name, a.email, a.phone, a.status, a.verify_status,
            a.last_login_at, a.created_at, p.college_code, dc.label AS college_name, p.student_no, p.teacher_no, p.avatar_url
     FROM account a
     LEFT JOIN user_profile p ON p.account_id=a.id
     LEFT JOIN dict_item dc ON dc.type='COLLEGE' AND dc.code=p.college_code
     ${w} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
}

async function setUserStatus(operator, id, status) {
  if (!['ACTIVE', 'DISABLED', 'LOCKED'].includes(status)) throw new AppError(400, 'VALIDATION', '非法状态');
  const acc = await accountService.findById(id);
  if (!acc) throw new AppError(404, 'NOT_FOUND', '用户不存在');
  if (acc.user_type === 'ADMIN' && status !== 'ACTIVE') throw new AppError(400, 'VALIDATION', '不能禁用超级管理员');
  await pool.query('UPDATE account SET status=?, locked_until=IF(?=\'LOCKED\', NOW(3) + INTERVAL 15 MINUTE, NULL), failed_count=0 WHERE id=?', [status, status, id]);
  if (status === 'DISABLED' || status === 'LOCKED') await accountService.revokeAllTokens(id);
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'ACCOUNT_STATUS', module: 'admin', resource_type: 'ACCOUNT', resource_id: id, detail: { status } });
  return true;
}

async function resetPassword(operator, id, newPassword) {
  if (!newPassword || String(newPassword).length < 6) throw new AppError(400, 'VALIDATION', '新密码长度至少 6 位');
  const acc = await accountService.findById(id);
  if (!acc) throw new AppError(404, 'NOT_FOUND', '用户不存在');
  const h = await hash(newPassword);
  await pool.query('UPDATE account SET password_hash=?, password_updated_at=NOW(3), failed_count=0 WHERE id=?', [h, id]);
  await accountService.revokeAllTokens(id);
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'ACCOUNT_RESET_PASSWORD', module: 'admin', resource_type: 'ACCOUNT', resource_id: id });
  return true;
}

async function createUser(operator, data) {
  const { username, password, userType, realName } = data;
  if (!username || !password || !userType || !realName) throw new AppError(400, 'VALIDATION', '用户名、密码、类型、姓名为必填');
  if (!['STUDENT', 'TEACHER', 'MANAGER', 'ADMIN'].includes(userType)) throw new AppError(400, 'VALIDATION', '非法用户类型');
  const exists = await accountService.findByUsername(username);
  if (exists) throw new AppError(409, 'USERNAME_EXISTS', '该用户名已存在');
  const h = await hash(password);
  const id = await withTransaction(async (conn) => {
    const [res] = await conn.query(
      'INSERT INTO account (username, password_hash, user_type, display_name, email, phone, created_at) VALUES (?,?,?,?,?,?,NOW(3))',
      [username, h, userType, realName, data.email || null, data.phone || null]
    );
    const aid = res.insertId;
    if (['STUDENT', 'TEACHER'].includes(userType)) {
      await conn.query(
        `INSERT INTO user_profile (account_id, user_type, real_name, student_no, teacher_no, gender, college_code, major_code, class_name, enrollment_year, graduation_year, degree_level, title, research_fields, bio, profile_completed, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW(3))`,
        [aid, userType, realName, data.studentNo || null, data.teacherNo || null, data.gender || null, data.collegeCode || null, data.majorCode || null, data.className || null, data.enrollmentYear || null, data.graduationYear || null, data.degreeLevel || null, data.title || null, data.researchFields || null, data.bio || null]
      );
    }
    return aid;
  });
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'ACCOUNT_CREATE', module: 'admin', resource_type: 'ACCOUNT', resource_id: id, detail: { userType, username } });
  return { id };
}

// ---------- 认证审核 ----------
async function listVerifications({ status, page, size, offset }) {
  const where = [];
  const params = [];
  if (status) { where.push('v.status=?'); params.push(status); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM user_verification v ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT v.*, a.username, a.display_name, p.student_no, p.teacher_no, p.college_code, dc.label AS college_name, p.avatar_url
     FROM user_verification v
     JOIN account a ON a.id=v.account_id
     LEFT JOIN user_profile p ON p.account_id=v.account_id
     LEFT JOIN dict_item dc ON dc.type='COLLEGE' AND dc.code=p.college_code
     ${w} ORDER BY FIELD(v.status,'PENDING_REVIEW','REJECTED','VERIFIED','UNVERIFIED'), v.created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows.map((r) => { r.materials = fromJson(r.materials); return r; }), total };
}

async function reviewVerification(operator, id, { status, reason }) {
  if (!['VERIFIED', 'REJECTED'].includes(status)) throw new AppError(400, 'VALIDATION', '审核结果仅支持通过/驳回');
  if (status === 'REJECTED' && !reason) throw new AppError(400, 'VALIDATION', '驳回需填写原因');
  const [rows] = await pool.query('SELECT * FROM user_verification WHERE id=?', [id]);
  const v = rows[0];
  if (!v) throw new AppError(404, 'NOT_FOUND', '认证记录不存在');
  await withTransaction(async (conn) => {
    await conn.query('UPDATE user_verification SET status=?, reason=?, reviewer_id=?, reviewed_at=NOW(3) WHERE id=?', [status, reason || null, operator.id, id]);
    await conn.query('UPDATE account SET verify_status=? WHERE id=?', [status, v.account_id]);
  });
  await notify.notify(v.account_id, 'SYSTEM', '认证审核结果', status === 'VERIFIED' ? '恭喜，你的身份认证已通过审核' : `你的身份认证被驳回：${reason || ''}`, '/profile');
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'VERIFICATION_REVIEW', module: 'admin', resource_type: 'VERIFICATION', resource_id: id, detail: { status, target: v.account_id } });
  return true;
}

// ---------- 字典管理 ----------
async function listDicts(type) {
  const where = type ? 'WHERE type=?' : '';
  const params = type ? [type] : [];
  const [rows] = await pool.query(`SELECT * FROM dict_item ${where} ORDER BY type, sort ASC, id ASC`, params);
  return rows;
}

async function saveDict(operator, { id, type, code, label, sort, parentCode, enabled }) {
  if (!type || !code || !label) throw new AppError(400, 'VALIDATION', '类型、编码、名称必填');
  if (id) {
    await pool.query('UPDATE dict_item SET type=?, code=?, label=?, sort=?, parent_code=?, enabled=? WHERE id=?', [type, code, label, sort || 0, parentCode || null, enabled === undefined ? 1 : (enabled ? 1 : 0), id]);
  } else {
    const [dup] = await pool.query('SELECT id FROM dict_item WHERE type=? AND code=?', [type, code]);
    if (dup[0]) throw new AppError(409, 'DICT_EXISTS', '该类型下编码已存在');
    await pool.query('INSERT INTO dict_item (type, code, label, sort, parent_code, enabled) VALUES (?,?,?,?,?,?)', [type, code, label, sort || 0, parentCode || null, enabled === undefined ? 1 : (enabled ? 1 : 0)]);
  }
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'DICT_SAVE', module: 'admin', resource_type: 'DICT', detail: { type, code } });
  return true;
}

async function deleteDict(operator, id) {
  const [rows] = await pool.query('SELECT * FROM dict_item WHERE id=?', [id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', '字典项不存在');
  await pool.query('DELETE FROM dict_item WHERE id=?', [id]);
  await audit.log({ operator_id: operator.id, operator_name: operator.displayName, action: 'DICT_DELETE', module: 'admin', resource_type: 'DICT', resource_id: id, detail: { type: rows[0].type, code: rows[0].code } });
  return true;
}

// ---------- 审计日志 ----------
async function listAuditLogs({ action, operatorId, page, size, offset }) {
  const where = [];
  const params = [];
  if (action) { where.push('action=?'); params.push(action); }
  if (operatorId) { where.push('operator_id=?'); params.push(operatorId); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM audit_log ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(`SELECT * FROM audit_log ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, offset]);
  return { items: rows.map((r) => { r.detail_json = fromJson(r.detail_json); return r; }), total };
}

// ---------- 仪表盘统计 ----------
async function stats() {
  const [byType] = await pool.query('SELECT user_type, COUNT(*) c FROM account GROUP BY user_type');
  const [comp] = await pool.query('SELECT status, COUNT(*) c FROM competition GROUP BY status');
  const [teams] = await pool.query("SELECT COUNT(*) c FROM team WHERE status<>'DISBANDED'");
  const [pending] = await pool.query("SELECT COUNT(*) c FROM user_verification WHERE status='PENDING_REVIEW'");
  const [recent] = await pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 8');
  return {
    userByType: byType,
    competitionByStatus: comp,
    teamCount: teams[0].c,
    pendingVerification: pending[0].c,
    recentAudits: recent.map((r) => { r.detail_json = fromJson(r.detail_json); return r; }),
  };
}

module.exports = { listUsers, setUserStatus, resetPassword, createUser, listVerifications, reviewVerification, listDicts, saveDict, deleteDict, listAuditLogs, stats };
