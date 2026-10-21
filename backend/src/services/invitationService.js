const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { addDays, nowStr } = require('../utils/helpers');
const teamService = require('./teamService');
const audit = require('./auditService');
const notify = require('./notificationService');

const TYPE_NAMES = {
  TEAM_INVITE_MEMBER: '邀请入队',
  STUDENT_INVITE_TEACHER: '邀请指导老师',
  TEACHER_INVITE_STUDENT: '老师邀请你入队',
  STUDENT_APPLY_JOIN: '入队申请',
};

async function getInvitation(id) {
  const [rows] = await pool.query('SELECT * FROM invitation WHERE id=?', [id]);
  return rows[0] || null;
}

async function checkPending(type, teamId, inviterId, inviteeId) {
  const [rows] = await pool.query(
    'SELECT id FROM invitation WHERE type=? AND IFNULL(team_id,0)=IFNULL(?,0) AND inviter_id=? AND invitee_id=? AND status=\'PENDING\'',
    [type, teamId || null, inviterId, inviteeId]
  );
  if (rows[0]) throw new AppError(409, 'DUPLICATE_PENDING', '已存在待处理的邀请/申请');
}

async function getAccountBrief(accountId) {
  const [rows] = await pool.query('SELECT id, display_name, user_type FROM account WHERE id=?', [accountId]);
  return rows[0] || null;
}

// ---------- 发起邀请/申请 ----------
async function create(user, data) {
  const { type, competitionId, teamId, inviteeId, message } = data;
  if (!type || !inviteeId) throw new AppError(400, 'VALIDATION', '缺少必要参数');
  if (!['TEAM_INVITE_MEMBER', 'STUDENT_INVITE_TEACHER', 'TEACHER_INVITE_STUDENT'].includes(type)) {
    throw new AppError(400, 'VALIDATION', '非法邀请类型');
  }
  const invitee = await getAccountBrief(inviteeId);
  if (!invitee) throw new AppError(404, 'NOT_FOUND', '被邀请用户不存在');

  let team = null;
  if (teamId) {
    team = await teamService.getTeam(teamId);
    if (!team) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  }

  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);

  if (type === 'TEAM_INVITE_MEMBER') {
    if (!team) throw new AppError(400, 'VALIDATION', '需指定队伍');
    if (team.leader_id !== user.id && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '仅队长可邀请队员');
    if (team.status !== 'RECRUITING') throw new AppError(409, 'TEAM_LOCKED', '队伍未处于招募状态');
    if (invitee.user_type !== 'STUDENT') throw new AppError(400, 'VALIDATION', '只能邀请学生入队');
    await checkPending(type, team.id, user.id, inviteeId);
  } else if (type === 'STUDENT_INVITE_TEACHER') {
    if (!team) throw new AppError(400, 'VALIDATION', '需指定队伍');
    if (team.leader_id !== user.id && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '仅队长可邀请老师');
    if (invitee.user_type !== 'TEACHER') throw new AppError(400, 'VALIDATION', '只能邀请教师');
    const [p] = await pool.query('SELECT accept_students FROM user_profile WHERE account_id=?', [inviteeId]);
    if (p[0] && !p[0].accept_students) throw new AppError(409, 'TEACHER_NOT_ACCEPT', '该老师暂不接受学生邀请');
    await checkPending(type, team.id, user.id, inviteeId);
  } else if (type === 'TEACHER_INVITE_STUDENT') {
    if (user.userType !== 'TEACHER') throw new AppError(403, 'PERMISSION_DENIED', '仅教师可挑选学生');
    if (!competitionId) throw new AppError(400, 'VALIDATION', '需指定赛事');
    if (invitee.user_type !== 'STUDENT') throw new AppError(400, 'VALIDATION', '只能邀请学生');
    const [p] = await pool.query('SELECT allow_teacher_invite FROM user_profile WHERE account_id=?', [inviteeId]);
    if (p[0] && !p[0].allow_teacher_invite) throw new AppError(409, 'STUDENT_NOT_ACCEPT', '该学生关闭了老师邀请');
    const [exist] = await pool.query(
      `SELECT 1 FROM team_member tm JOIN team t ON t.id=tm.team_id WHERE tm.account_id=? AND t.competition_id=? AND tm.role IN ('LEADER','MEMBER') AND tm.status='ACTIVE' AND t.status<>'DISBANDED'`,
      [inviteeId, competitionId]
    );
    if (exist[0]) throw new AppError(409, 'ALREADY_IN_TEAM', '该学生已在此赛事加入队伍');
    await checkPending(type, teamId || null, user.id, inviteeId);
  }

  const [res] = await pool.query(
    `INSERT INTO invitation (type, competition_id, team_id, inviter_id, invitee_id, message, status, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(3))`,
    [type, team ? team.competition_id : competitionId, teamId || null, user.id, inviteeId, message || null, 'PENDING', addDays(7)]
  );

  const inviterName = user.displayName || '同学/老师';
  await notify.notify(inviteeId, 'INVITATION', TYPE_NAMES[type], `${inviterName}${type === 'TEACHER_INVITE_STUDENT' ? '邀请你加入队伍' : '向你发起了' + TYPE_NAMES[type]}${team ? `：「${team.name}」` : ''}${message ? '，留言：' + message : ''}`, team ? `/teams/${team.id}` : null);

  return { id: res[0].insertId };
}

// ---------- 学生申请入队 ----------
async function createJoinRequest(user, data) {
  const { teamId, message } = data;
  if (!teamId) throw new AppError(400, 'VALIDATION', '需指定队伍');
  if (user.userType !== 'STUDENT') throw new AppError(403, 'PERMISSION_DENIED', '仅学生可申请入队');
  const team = await teamService.getTeam(teamId);
  if (!team) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (team.status !== 'RECRUITING') throw new AppError(409, 'TEAM_LOCKED', '该队伍未在招募');
  const [ex] = await pool.query('SELECT id FROM team_member WHERE team_id=? AND account_id=?', [teamId, user.id]);
  if (ex[0]) throw new AppError(409, 'ALREADY_MEMBER', '你已在该队伍中');
  await checkPending('STUDENT_APPLY_JOIN', teamId, user.id, team.leader_id);

  const [res] = await pool.query(
    `INSERT INTO invitation (type, competition_id, team_id, inviter_id, invitee_id, message, status, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(3))`,
    ['STUDENT_APPLY_JOIN', team.competition_id, teamId, user.id, team.leader_id, message || null, 'PENDING', addDays(7)]
  );
  await notify.notify(team.leader_id, 'INVITATION', '收到入队申请', `${user.displayName} 申请加入「${team.name}」${message ? '：' + message : ''}`, `/teams/${teamId}`);
  return { id: res[0].insertId };
}

// ---------- 邀请列表 ----------
async function list(user, { direction = 'in', status, page, size, offset }) {
  const where = [];
  const params = [];
  if (direction === 'in') { where.push('i.invitee_id=?'); params.push(user.id); }
  else if (direction === 'out') { where.push('i.inviter_id=?'); params.push(user.id); }
  else throw new AppError(400, 'VALIDATION', 'direction 仅支持 in/out');
  if (status) { where.push('i.status=?'); params.push(status); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(
    `SELECT COUNT(*) c FROM invitation i WHERE ${w}`, params
  );
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT i.*, t.name AS team_name, c.title AS competition_title,
            a1.display_name AS inviter_name, a2.display_name AS invitee_name
     FROM invitation i
     LEFT JOIN team t ON t.id=i.team_id
     LEFT JOIN competition c ON c.id=i.competition_id
     JOIN account a1 ON a1.id=i.inviter_id
     JOIN account a2 ON a2.id=i.invitee_id
     WHERE ${w} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
}

// ---------- 接受 ----------
async function accept(id, user) {
  const inv = await getInvitation(id);
  if (!inv) throw new AppError(404, 'NOT_FOUND', '邀请不存在');
  if (inv.status !== 'PENDING') throw new AppError(409, 'STATE_CONFLICT', '该邀请已处理');
  if (inv.expires_at <= nowStr()) {
    await pool.query("UPDATE invitation SET status='EXPIRED' WHERE id=?", [id]);
    throw new AppError(410, 'INVITATION_EXPIRED', '邀请已过期');
  }
  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);

  if (inv.type === 'STUDENT_APPLY_JOIN') {
    if (inv.invitee_id !== user.id && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '仅队长可审批入队申请');
    await teamService.joinStudent(inv.team_id, inv.inviter_id, 'SELF', inv.inviter_id);
  } else if (inv.type === 'STUDENT_INVITE_TEACHER') {
    if (inv.invitee_id !== user.id) throw new AppError(403, 'PERMISSION_DENIED', '无权限处理该邀请');
    await teamService.joinAdvisor(inv.team_id, inv.invitee_id, 'INVITE', inv.inviter_id);
  } else {
    if (inv.invitee_id !== user.id) throw new AppError(403, 'PERMISSION_DENIED', '无权限处理该邀请');
    await teamService.joinStudent(inv.team_id, inv.invitee_id, 'INVITE', inv.inviter_id);
  }

  await pool.query("UPDATE invitation SET status='ACCEPTED', responded_at=NOW(3) WHERE id=?", [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'INVITATION_ACCEPT', module: 'team', resource_type: 'INVITATION', resource_id: id });
  return true;
}

// ---------- 拒绝 ----------
async function reject(id, user, reason) {
  const inv = await getInvitation(id);
  if (!inv) throw new AppError(404, 'NOT_FOUND', '邀请不存在');
  if (inv.status !== 'PENDING') throw new AppError(409, 'STATE_CONFLICT', '该邀请已处理');
  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);
  const responder = inv.type === 'STUDENT_APPLY_JOIN' ? inv.invitee_id : inv.invitee_id;
  if (responder !== user.id && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '无权限处理该邀请');
  await pool.query("UPDATE invitation SET status='REJECTED', responded_at=NOW(3), reject_reason=? WHERE id=?", [reason || null, id]);
  return true;
}

// ---------- 撤回 ----------
async function cancel(id, user) {
  const inv = await getInvitation(id);
  if (!inv) throw new AppError(404, 'NOT_FOUND', '邀请不存在');
  if (inv.inviter_id !== user.id && !['MANAGER', 'ADMIN'].includes(user.userType)) {
    throw new AppError(403, 'PERMISSION_DENIED', '无权限撤回');
  }
  if (inv.status !== 'PENDING') throw new AppError(409, 'STATE_CONFLICT', '该邀请已处理');
  await pool.query("UPDATE invitation SET status='CANCELLED' WHERE id=?", [id]);
  return true;
}

// ---------- 队长视角的入队申请列表 ----------
async function listJoinRequests(user) {
  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);
  const [teams] = await pool.query('SELECT id FROM team WHERE leader_id=? AND status<>\'DISBANDED\'', [user.id]);
  const teamIds = teams.map((t) => t.id);
  if (!isManager && !teamIds.length) return { items: [], total: 0 };
  let where = "i.type='STUDENT_APPLY_JOIN' AND i.status='PENDING'";
  const params = [];
  if (!isManager) {
    where += ' AND i.team_id IN (?)';
    params.push(teamIds);
  }
  const [rows] = await pool.query(
    `SELECT i.*, t.name AS team_name, c.title AS competition_title, a1.display_name AS inviter_name, a1.user_type AS inviter_type,
            p.college_code, dc.label AS college_name, p.degree_level, p.skills
     FROM invitation i
     LEFT JOIN team t ON t.id=i.team_id
     LEFT JOIN competition c ON c.id=i.competition_id
     JOIN account a1 ON a1.id=i.inviter_id
     LEFT JOIN user_profile p ON p.account_id=i.inviter_id
     LEFT JOIN dict_item dc ON dc.type='COLLEGE' AND dc.code=p.college_code
     WHERE ${where} ORDER BY i.created_at DESC`, params
  );
  return { items: rows, total: rows.length };
}

module.exports = { create, createJoinRequest, list, accept, reject, cancel, listJoinRequests };
