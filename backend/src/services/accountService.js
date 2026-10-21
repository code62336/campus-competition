const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { hash, compare } = require('../utils/password');
const { signAccess, genRefreshToken, genFamilyId, sha256 } = require('../utils/jwt');
const { toDateTime, nowStr, fromJson } = require('../utils/helpers');
const { ROLE_PERMISSIONS } = require('../config');
const audit = require('./auditService');

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;
const REFRESH_DAYS = 7;

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM account WHERE id = ?', [id]);
  return rows[0] || null;
}
async function findByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM account WHERE username = ?', [username]);
  return rows[0] || null;
}
function publicAccount(acc) {
  return {
    id: acc.id,
    username: acc.username,
    userType: acc.user_type,
    displayName: acc.display_name,
    email: acc.email,
    phone: acc.phone,
    status: acc.status,
    verifyStatus: acc.verify_status,
  };
}

// ---------- 注册 ----------
async function register(input) {
  const { username, password, userType, realName } = input;
  if (!username || !password || !realName) throw new AppError(400, 'VALIDATION', '用户名、密码、真实姓名为必填项');
  if (!['STUDENT', 'TEACHER'].includes(userType)) throw new AppError(400, 'VALIDATION', '注册类型仅支持学生或教师');
  if (String(password).length < 6) throw new AppError(400, 'VALIDATION', '密码长度至少 6 位');

  const exists = await findByUsername(username);
  if (exists) throw new AppError(409, 'USERNAME_EXISTS', '该用户名已被注册');

  const passwordHash = await hash(password);
  const accountId = await withTransaction(async (conn) => {
    const [accRes] = await conn.query(
      `INSERT INTO account (username, password_hash, user_type, display_name, email, phone, created_at)
       VALUES (?,?,?,?,?,?,NOW(3))`,
      [username, passwordHash, userType, realName, input.email || null, input.phone || null]
    );
    const id = accRes.insertId;
    await conn.query(
      `INSERT INTO user_profile
        (account_id, user_type, real_name, student_no, teacher_no, gender, college_code, major_code,
         class_name, enrollment_year, graduation_year, degree_level, title, research_fields, bio, profile_completed, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3))`,
      [
        id, userType, realName,
        input.studentNo || null, input.teacherNo || null, input.gender || null,
        input.collegeCode || null, input.majorCode || null, input.className || null,
        input.enrollmentYear || null, input.graduationYear || null, input.degreeLevel || null,
        input.title || null, input.researchFields || null, input.bio || null, 1,
      ]
    );
    return id;
  });

  await audit.log({ operator_id: accountId, operator_name: realName, action: 'REGISTER', module: 'auth', detail: { userType, username } });
  return { id: accountId };
}

// ---------- 登录 ----------
async function login({ username, password, ip }) {
  const acc = await findByUsername(username);
  if (!acc) {
    await audit.log({ action: 'LOGIN', module: 'auth', detail: { username, success: false, reason: 'USER_NOT_FOUND' }, ip, result: 'FAILED' });
    throw new AppError(401, 'BAD_CREDENTIALS', '用户名或密码错误');
  }
  if (acc.status === 'DISABLED' || acc.status === 'DELETED') throw new AppError(403, 'ACCOUNT_DISABLED', '账号已被禁用，请联系管理员');
  if (acc.status === 'LOCKED' || (acc.locked_until && acc.locked_until > nowStr())) {
    throw new AppError(423, 'ACCOUNT_LOCKED', `账号已锁定，请 ${LOCK_MINUTES} 分钟后再试`);
  }

  const ok = await compare(password, acc.password_hash);
  if (!ok) {
    const failed = acc.failed_count + 1;
    let status = acc.status;
    let lockedUntil = null;
    if (failed >= LOCK_THRESHOLD) {
      status = 'LOCKED';
      lockedUntil = toDateTime(new Date(Date.now() + LOCK_MINUTES * 60 * 1000));
    }
    await pool.query('UPDATE account SET failed_count=?, status=?, locked_until=? WHERE id=?', [failed, status, lockedUntil, acc.id]);
    await audit.log({ operator_id: acc.id, action: 'LOGIN', module: 'auth', detail: { username, success: false, reason: 'BAD_PASSWORD' }, ip, result: 'FAILED' });
    throw new AppError(401, 'BAD_CREDENTIALS', `用户名或密码错误${failed >= LOCK_THRESHOLD ? '，账号已锁定' : ''}`);
  }

  await pool.query('UPDATE account SET failed_count=0, status=?, locked_until=NULL, last_login_at=NOW(3), last_login_ip=? WHERE id=?', [acc.status === 'LOCKED' ? 'ACTIVE' : acc.status, ip || null, acc.id]);

  const accessToken = signAccess(acc);
  const refreshToken = genRefreshToken();
  const familyId = genFamilyId();
  await pool.query(
    'INSERT INTO refresh_token (account_id, token_hash, family_id, expires_at) VALUES (?,?,?,?)',
    [acc.id, sha256(refreshToken), familyId, toDateTime(new Date(Date.now() + REFRESH_DAYS * 24 * 3600 * 1000))]
  );
  await audit.log({ operator_id: acc.id, operator_name: acc.display_name, action: 'LOGIN', module: 'auth', detail: { username, success: true }, ip });

  return { accessToken, refreshToken, user: publicAccount(acc) };
}

// ---------- 刷新令牌（轮换） ----------
async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError(401, 'REFRESH_REQUIRED', '缺少刷新令牌');
  const tokenHash = sha256(refreshToken);
  const [rows] = await pool.query('SELECT * FROM refresh_token WHERE token_hash = ?', [tokenHash]);
  const rt = rows[0];
  if (!rt || rt.revoked_at) throw new AppError(401, 'REFRESH_REUSED', '登录状态异常，请重新登录');
  if (rt.expires_at <= nowStr()) throw new AppError(401, 'REFRESH_EXPIRED', '登录已过期，请重新登录');

  const acc = await findById(rt.account_id);
  if (!acc || (acc.status !== 'ACTIVE')) throw new AppError(401, 'ACCOUNT_INVALID', '账号不可用，请重新登录');

  const newRefresh = genRefreshToken();
  await withTransaction(async (conn) => {
    await conn.query('UPDATE refresh_token SET revoked_at=NOW(3) WHERE id=?', [rt.id]);
    await conn.query(
      'INSERT INTO refresh_token (account_id, token_hash, family_id, expires_at) VALUES (?,?,?,?)',
      [acc.id, sha256(newRefresh), rt.family_id, toDateTime(new Date(Date.now() + REFRESH_DAYS * 24 * 3600 * 1000))]
    );
  });
  return { accessToken: signAccess(acc), refreshToken: newRefresh };
}

async function logout(refreshToken) {
  if (refreshToken) await pool.query('UPDATE refresh_token SET revoked_at=NOW(3) WHERE token_hash=?', [sha256(refreshToken)]);
}

async function revokeAllTokens(accountId) {
  await pool.query('UPDATE refresh_token SET revoked_at=NOW(3) WHERE account_id=? AND revoked_at IS NULL', [accountId]);
}

// ---------- 当前用户 ----------
async function getMe(accountId) {
  const acc = await findById(accountId);
  if (!acc) throw new AppError(404, 'NOT_FOUND', '账号不存在');
  const [prows] = await pool.query('SELECT * FROM user_profile WHERE account_id=?', [accountId]);
  const profile = prows[0] || null;
  if (profile) {
    profile.skills = fromJson(profile.skills);
  }
  const [unread] = await pool.query('SELECT COUNT(*) c FROM notification WHERE recipient_id=? AND read_at IS NULL', [accountId]);
  return {
    ...publicAccount(acc),
    permissions: ROLE_PERMISSIONS[acc.user_type] || [],
    profile,
    unreadCount: unread[0].c,
  };
}

// ---------- 修改密码 ----------
async function changePassword(accountId, { oldPassword, newPassword }) {
  if (!oldPassword || !newPassword) throw new AppError(400, 'VALIDATION', '请填写原密码与新密码');
  if (String(newPassword).length < 6) throw new AppError(400, 'VALIDATION', '新密码长度至少 6 位');
  const acc = await findById(accountId);
  if (!acc) throw new AppError(404, 'NOT_FOUND', '账号不存在');
  const ok = await compare(oldPassword, acc.password_hash);
  if (!ok) throw new AppError(400, 'BAD_PASSWORD', '原密码不正确');
  const newHash = await hash(newPassword);
  await pool.query('UPDATE account SET password_hash=?, password_updated_at=NOW(3) WHERE id=?', [newHash, accountId]);
  await revokeAllTokens(accountId);
  await audit.log({ operator_id: accountId, operator_name: acc.display_name, action: 'PASSWORD_CHANGE', module: 'auth' });
  return true;
}

// ---------- 找回密码（验证码） ----------
async function sendCode({ email, purpose }) {
  if (!email) throw new AppError(400, 'VALIDATION', '请填写邮箱');
  if (!['RESET_PASSWORD', 'REGISTER', 'BIND_EMAIL'].includes(purpose)) throw new AppError(400, 'VALIDATION', '非法用途');
  const [accRows] = await pool.query('SELECT id FROM account WHERE email=?', [email]);
  if (purpose === 'RESET_PASSWORD' && !accRows[0]) throw new AppError(404, 'EMAIL_NOT_FOUND', '该邮箱未注册');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await pool.query('INSERT INTO verification_code (contact, purpose, code_hash, expires_at) VALUES (?,?,?,?)', [
    email, purpose, sha256(code), toDateTime(new Date(Date.now() + 10 * 60 * 1000)),
  ]);
  // 演示环境：无 SMTP，验证码打印到日志并返回（生产环境应通过邮件发送，切勿返回）
  console.log(`[验证码] ${email} (${purpose}): ${code}`);
  return { sent: true, devCode: code };
}

async function resetPassword({ email, code, newPassword }) {
  if (!email || !code || !newPassword) throw new AppError(400, 'VALIDATION', '请完整填写邮箱、验证码、新密码');
  if (String(newPassword).length < 6) throw new AppError(400, 'VALIDATION', '新密码长度至少 6 位');
  const [rows] = await pool.query(
    'SELECT * FROM verification_code WHERE contact=? AND purpose=? AND code_hash=? AND used_at IS NULL ORDER BY id DESC LIMIT 1',
    [email, 'RESET_PASSWORD', sha256(code)]
  );
  const vc = rows[0];
  if (!vc) throw new AppError(400, 'BAD_CODE', '验证码错误');
  if (vc.expires_at <= nowStr()) throw new AppError(400, 'CODE_EXPIRED', '验证码已过期');
  const [accRows] = await pool.query('SELECT id FROM account WHERE email=?', [email]);
  if (!accRows[0]) throw new AppError(404, 'EMAIL_NOT_FOUND', '该邮箱未注册');
  const newHash = await hash(newPassword);
  await pool.query('UPDATE account SET password_hash=?, password_updated_at=NOW(3) WHERE id=?', [newHash, accRows[0].id]);
  await pool.query('UPDATE verification_code SET used_at=NOW(3) WHERE id=?', [vc.id]);
  await revokeAllTokens(accRows[0].id);
  return true;
}

module.exports = {
  register, login, refresh, logout, getMe, changePassword, sendCode, resetPassword,
  findById, findByUsername, revokeAllTokens, publicAccount,
};
