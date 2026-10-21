const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { fromJson } = require('../utils/helpers');
const audit = require('./auditService');
const notify = require('./notificationService');
const competitionService = require('./competitionService');

const MEMBER_ROLE_SQL = "tm.role IN ('LEADER','MEMBER')";

async function getTeam(id) {
  const [rows] = await pool.query('SELECT * FROM team WHERE id=?', [id]);
  return rows[0] || null;
}

// 该学生在某赛事中是否已有有效队伍
async function hasActiveTeam(conn, accountId, competitionId) {
  const [rows] = await conn.query(
    `SELECT 1 FROM team_member tm JOIN team t ON t.id=tm.team_id
     WHERE tm.account_id=? AND t.competition_id=? AND ${MEMBER_ROLE_SQL} AND tm.status='ACTIVE' AND t.status<>'DISBANDED'`,
    [accountId, competitionId]
  );
  return !!rows[0];
}

// ---------- 学生加入（事务内，已对 team 加锁） ----------
async function joinStudent(teamId, accountId, source, invitedBy) {
  return withTransaction(async (conn) => {
    const [trows] = await conn.query('SELECT * FROM team WHERE id=? FOR UPDATE', [teamId]);
    const t = trows[0];
    if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
    if (t.status !== 'RECRUITING') throw new AppError(409, 'TEAM_LOCKED', '队伍未处于招募状态');
    if (t.member_count >= t.max_members) throw new AppError(409, 'TEAM_FULL', '队伍人数已满');

    const [ex] = await conn.query('SELECT id FROM team_member WHERE team_id=? AND account_id=?', [teamId, accountId]);
    if (ex[0]) throw new AppError(409, 'ALREADY_MEMBER', '该学生已在队伍中');

    if (await hasActiveTeam(conn, accountId, t.competition_id)) {
      throw new AppError(409, 'ALREADY_IN_TEAM', '该学生已在此赛事加入其他队伍');
    }

    const [prows] = await conn.query('SELECT real_name FROM user_profile WHERE account_id=?', [accountId]);
    const snapshot = prows[0] ? prows[0].real_name : null;
    await conn.query(
      `INSERT INTO team_member (team_id, account_id, role, status, source, invited_by, real_name_snapshot, joined_at, created_at)
       VALUES (?,?,?,?,?,?,?,NOW(3),NOW(3))`,
      [teamId, accountId, 'MEMBER', 'ACTIVE', source, invitedBy || null, snapshot]
    );
    await conn.query('UPDATE team SET member_count=member_count+1 WHERE id=?', [teamId]);
    return t;
  });
}

// ---------- 老师加入（事务内，已对 team 加锁） ----------
async function joinAdvisor(teamId, advisorId, source, invitedBy) {
  return withTransaction(async (conn) => {
    const [trows] = await conn.query('SELECT * FROM team WHERE id=? FOR UPDATE', [teamId]);
    const t = trows[0];
    if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
    if (t.status === 'DISBANDED') throw new AppError(409, 'TEAM_DISBANDED', '队伍已解散');
    const comp = await competitionService.findById(t.competition_id);
    if (!comp) throw new AppError(404, 'NOT_FOUND', '赛事不存在');

    const [ex] = await conn.query("SELECT id FROM team_member WHERE team_id=? AND account_id=? AND role='ADVISOR'", [teamId, advisorId]);
    if (ex[0]) throw new AppError(409, 'ALREADY_ADVISOR', '该老师已是本队指导老师');

    const [cntTeam] = await conn.query("SELECT COUNT(*) c FROM team_member WHERE team_id=? AND role='ADVISOR' AND status='ACTIVE'", [teamId]);
    if (cntTeam[0].c >= comp.max_teacher_count) throw new AppError(409, 'ADVISOR_FULL', '该队指导老师已达上限');

    const [cntComp] = await conn.query(
      `SELECT COUNT(*) c FROM team_member tm JOIN team t2 ON t2.id=tm.team_id
       WHERE tm.account_id=? AND tm.role='ADVISOR' AND tm.status='ACTIVE' AND t2.competition_id=? AND t2.status<>'DISBANDED'`,
      [advisorId, t.competition_id]
    );
    if (cntComp[0].c >= comp.max_teams_per_teacher) throw new AppError(409, 'TEACHER_COMP_FULL', '该老师在本赛事带队数已达上限');

    const [prows] = await conn.query('SELECT max_teams, real_name FROM user_profile WHERE account_id=?', [advisorId]);
    if (prows[0]) {
      const [cntGlobal] = await conn.query(
        `SELECT COUNT(*) c FROM team_member tm JOIN team t2 ON t2.id=tm.team_id
         WHERE tm.account_id=? AND tm.role='ADVISOR' AND tm.status='ACTIVE' AND t2.status<>'DISBANDED'`,
        [advisorId]
      );
      if (cntGlobal[0].c >= prows[0].max_teams) throw new AppError(409, 'TEACHER_FULL', '该老师带队总数已达上限');
    }

    const snapshot = prows[0] ? prows[0].real_name : null;
    await conn.query(
      `INSERT INTO team_member (team_id, account_id, role, status, source, invited_by, real_name_snapshot, joined_at, created_at)
       VALUES (?,?,?,?,?,?,?,NOW(3),NOW(3))`,
      [teamId, advisorId, 'ADVISOR', 'ACTIVE', source, invitedBy || null, snapshot]
    );
    await conn.query('UPDATE team SET advisor_id=IFNULL(advisor_id, ?) WHERE id=?', [advisorId, teamId]);
    return t;
  });
}

// ---------- 建队 ----------
async function create(user, data) {
  const { competitionId, name } = data;
  if (!competitionId || !name) throw new AppError(400, 'VALIDATION', '赛事与队名为必填');
  const comp = await competitionService.findById(competitionId);
  if (!comp) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (comp.status !== 'PUBLISHED') throw new AppError(409, 'STATE_CONFLICT', '赛事未开放组队');

  let leaderId = user.id;
  let source = 'SELF';
  if (user.userType === 'MANAGER' || user.userType === 'ADMIN') {
    if (!data.leaderId) throw new AppError(400, 'VALIDATION', '负责人代建需指定队长(leaderId)');
    leaderId = data.leaderId;
    source = 'ASSIGN';
  } else if (user.userType !== 'STUDENT') {
    throw new AppError(403, 'PERMISSION_DENIED', '仅学生或负责人可建队');
  }

  const [leader] = await pool.query("SELECT id, user_type, display_name FROM account WHERE id=? AND user_type='STUDENT'", [leaderId]);
  if (!leader[0]) throw new AppError(400, 'VALIDATION', '队长必须是学生账号');

  if (source === 'SELF' && !competitionService.windowOpen(comp)) {
    throw new AppError(409, 'REGISTER_CLOSED', '组队时间已截止');
  }

  let trackId = data.trackId || null;
  if (trackId) {
    const tracks = fromJson(comp.tracks_json) || [];
    if (!tracks.find((x) => x.id === trackId)) throw new AppError(400, 'VALIDATION', '赛道不存在');
  }

  const [dup] = await pool.query("SELECT id FROM team WHERE competition_id=? AND name=? AND status<>'DISBANDED'", [competitionId, name]);
  if (dup[0]) throw new AppError(409, 'TEAM_NAME_EXISTS', '该赛事下队名已存在');

  const [prows] = await pool.query('SELECT college_code, real_name FROM user_profile WHERE account_id=?', [leaderId]);
  const collegeCode = prows[0] ? prows[0].college_code : null;

  const id = await withTransaction(async (conn) => {
    if (await hasActiveTeam(conn, leaderId, competitionId)) {
      throw new AppError(409, 'ALREADY_IN_TEAM', '队长已在该赛事中加入队伍');
    }
    const [res] = await conn.query(
      `INSERT INTO team (competition_id, track_id, name, slogan, college_code, leader_id, status, member_count, max_members, recruiting, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(3))`,
      [competitionId, trackId, name, data.slogan || null, collegeCode, leaderId, 'RECRUITING', 1, comp.max_team_size, 1, user.id]
    );
    const teamId = res.insertId;
    await conn.query(
      `INSERT INTO team_member (team_id, account_id, role, status, source, invited_by, real_name_snapshot, joined_at, created_at)
       VALUES (?,?,?,?,?,?,?,NOW(3),NOW(3))`,
      [teamId, leaderId, 'LEADER', 'ACTIVE', source, user.id, prows[0] ? prows[0].real_name : null]
    );
    return teamId;
  });

  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_CREATE', module: 'team', resource_type: 'TEAM', resource_id: id, detail: { competitionId, name, onBehalf: source === 'ASSIGN' } });
  if (source === 'ASSIGN') {
    await notify.notify(leaderId, 'TEAM', '你被分配为队长', `赛事「${comp.title}」中你被负责人分配为「${name}」队长`, `/teams/${id}`);
  }
  return detail(id, user);
}

// ---------- 队伍详情 ----------
async function detail(id, user) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  const comp = await competitionService.findById(t.competition_id);

  const [members] = await pool.query(
    `SELECT tm.id, tm.account_id, tm.role, tm.status, tm.source, tm.real_name_snapshot, tm.joined_at,
            p.real_name, p.college_code, dc.label AS college_name, p.student_no, p.teacher_no, p.degree_level,
            p.avatar_url, p.title, p.research_fields, p.skills
     FROM team_member tm
     LEFT JOIN user_profile p ON p.account_id=tm.account_id
     LEFT JOIN dict_item dc ON dc.type='COLLEGE' AND dc.code=p.college_code
     WHERE tm.team_id=?
     ORDER BY FIELD(tm.role,'LEADER','MEMBER','ADVISOR'), tm.joined_at ASC`,
    [id]
  );
  for (const m of members) m.skills = fromJson(m.skills);

  const isLeader = !!(user && t.leader_id === user.id);
  const isMember = !!(user && members.some((m) => m.account_id === user.id && ['LEADER', 'MEMBER'].includes(m.role) && m.status === 'ACTIVE'));
  const isAdvisor = !!(user && members.some((m) => m.account_id === user.id && m.role === 'ADVISOR' && m.status === 'ACTIVE'));
  const isManager = !!(user && ['MANAGER', 'ADMIN'].includes(user.userType));

  return {
    id: t.id,
    competition_id: t.competition_id,
    competition_title: comp ? comp.title : null,
    track_id: t.track_id,
    name: t.name,
    slogan: t.slogan,
    college_code: t.college_code,
    leader_id: t.leader_id,
    advisor_id: t.advisor_id,
    status: t.status,
    member_count: t.member_count,
    max_members: t.max_members,
    recruiting: t.recruiting,
    locked_at: t.locked_at,
    created_at: t.created_at,
    members,
    actions: { isLeader, isMember, isAdvisor, isManager, canEdit: isLeader || isManager, canDisband: isLeader || isManager, canLock: isManager, canTransfer: isLeader || isManager, canAssignAdvisor: isManager },
  };
}

// ---------- 更新 ----------
async function update(id, user, data) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  const isLeader = t.leader_id === user.id;
  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);
  if (!isLeader && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '无权限修改队伍');

  const sets = [];
  const values = [];
  if (data.name !== undefined) {
    const [dup] = await pool.query("SELECT id FROM team WHERE competition_id=? AND name=? AND id<>? AND status<>'DISBANDED'", [t.competition_id, data.name, id]);
    if (dup[0]) throw new AppError(409, 'TEAM_NAME_EXISTS', '该赛事下队名已存在');
    sets.push('name=?'); values.push(data.name);
  }
  if (data.slogan !== undefined) { sets.push('slogan=?'); values.push(data.slogan); }
  if (data.recruiting !== undefined) { sets.push('recruiting=?'); values.push(data.recruiting ? 1 : 0); }
  if (data.trackId !== undefined) {
    if (t.status === 'LOCKED') throw new AppError(423, 'TEAM_LOCKED', '队伍已锁定，不可更改赛道');
    sets.push('track_id=?'); values.push(data.trackId);
  }
  if (!sets.length) throw new AppError(400, 'VALIDATION', '没有可更新的字段');
  values.push(id);
  await pool.query(`UPDATE team SET ${sets.join(', ')} WHERE id=?`, values);
  return detail(id, user);
}

// ---------- 解散 / 锁定 ----------
async function disband(id, user) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (t.leader_id !== user.id && !['MANAGER', 'ADMIN'].includes(user.userType)) throw new AppError(403, 'PERMISSION_DENIED', '无权限解散队伍');
  if (t.status === 'DISBANDED') throw new AppError(409, 'STATE_CONFLICT', '队伍已解散');
  await pool.query("UPDATE team SET status='DISBANDED', recruiting=0 WHERE id=?", [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_DISBAND', module: 'team', resource_type: 'TEAM', resource_id: id });
  return true;
}

async function lock(id, user) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (!['MANAGER', 'ADMIN'].includes(user.userType)) throw new AppError(403, 'PERMISSION_DENIED', '仅负责人可锁定');
  await pool.query("UPDATE team SET status='LOCKED', locked_at=NOW(3), recruiting=0 WHERE id=?", [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_LOCK', module: 'team', resource_type: 'TEAM', resource_id: id });
  return detail(id, user);
}

async function unlock(id, user) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (!['MANAGER', 'ADMIN'].includes(user.userType)) throw new AppError(403, 'PERMISSION_DENIED', '仅负责人可解锁');
  await pool.query("UPDATE team SET status='RECRUITING', locked_at=NULL WHERE id=?", [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_UNLOCK', module: 'team', resource_type: 'TEAM', resource_id: id });
  return detail(id, user);
}

// ---------- 转让队长 ----------
async function transferLeader(id, user, newLeaderId) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (t.leader_id !== user.id && !['MANAGER', 'ADMIN'].includes(user.userType)) throw new AppError(403, 'PERMISSION_DENIED', '无权限转让队长');
  const [m] = await pool.query("SELECT id FROM team_member WHERE team_id=? AND account_id=? AND role='MEMBER' AND status='ACTIVE'", [id, newLeaderId]);
  if (!m[0]) throw new AppError(400, 'VALIDATION', '新队长必须是队伍中的队员');
  await withTransaction(async (conn) => {
    await conn.query("UPDATE team_member SET role='LEADER' WHERE team_id=? AND account_id=?", [id, newLeaderId]);
    await conn.query("UPDATE team_member SET role='MEMBER' WHERE team_id=? AND account_id=?", [id, t.leader_id]);
    await conn.query('UPDATE team SET leader_id=? WHERE id=?', [newLeaderId, id]);
  });
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_TRANSFER_LEADER', module: 'team', resource_type: 'TEAM', resource_id: id, detail: { from: t.leader_id, to: newLeaderId } });
  return detail(id, user);
}

// ---------- 退出 / 移出 ----------
async function leave(id, user) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (t.leader_id === user.id) throw new AppError(400, 'LEADER_CANNOT_LEAVE', '队长不能直接退出，请先转让队长');
  const [m] = await pool.query('SELECT role, status FROM team_member WHERE team_id=? AND account_id=?', [id, user.id]);
  if (!m[0]) throw new AppError(404, 'NOT_FOUND', '你不是该队成员');
  await withTransaction(async (conn) => {
    if (m[0].role === 'ADVISOR') {
      await conn.query("UPDATE team_member SET status='RELEASED', left_at=NOW(3) WHERE team_id=? AND account_id=?", [id, user.id]);
      await conn.query('UPDATE team SET advisor_id=NULL WHERE id=? AND advisor_id=?', [id, user.id]);
    } else {
      await conn.query("UPDATE team_member SET status='LEFT', left_at=NOW(3) WHERE team_id=? AND account_id=?", [id, user.id]);
      await conn.query('UPDATE team SET member_count=member_count-1 WHERE id=?', [id]);
    }
  });
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_LEAVE', module: 'team', resource_type: 'TEAM', resource_id: id });
  return true;
}

async function removeMember(id, user, targetId) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  const isLeader = t.leader_id === user.id;
  const isManager = ['MANAGER', 'ADMIN'].includes(user.userType);
  if (!isLeader && !isManager) throw new AppError(403, 'PERMISSION_DENIED', '无权限移除成员');
  if (targetId === t.leader_id) throw new AppError(400, 'VALIDATION', '不能移除队长');
  const [m] = await pool.query('SELECT role, status FROM team_member WHERE team_id=? AND account_id=?', [id, targetId]);
  if (!m[0]) throw new AppError(404, 'NOT_FOUND', '该成员不在队伍中');
  await withTransaction(async (conn) => {
    if (m[0].role === 'ADVISOR') {
      await conn.query("UPDATE team_member SET status='RELEASED', left_at=NOW(3) WHERE team_id=? AND account_id=?", [id, targetId]);
      await conn.query('UPDATE team SET advisor_id=NULL WHERE id=? AND advisor_id=?', [id, targetId]);
    } else {
      await conn.query("UPDATE team_member SET status='LEFT', left_at=NOW(3) WHERE team_id=? AND account_id=?", [id, targetId]);
      await conn.query('UPDATE team SET member_count=member_count-1 WHERE id=?', [id]);
    }
  });
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_REMOVE_MEMBER', module: 'team', resource_type: 'TEAM', resource_id: id, detail: { targetId } });
  return detail(id, user);
}

// ---------- 我的队伍 ----------
async function mine(user) {
  const [rows] = await pool.query(
    `SELECT DISTINCT t.*, c.title AS competition_title, c.status AS competition_status
     FROM team t
     JOIN team_member tm ON tm.team_id=t.id
     JOIN competition c ON c.id=t.competition_id
     WHERE tm.account_id=? AND tm.status='ACTIVE' AND t.status<>'DISBANDED'
     ORDER BY t.updated_at DESC`,
    [user.id]
  );
  return rows;
}

// ---------- 找队友广场 ----------
async function recruiting({ competitionId, keyword, page, size, offset }) {
  const where = ["t.status='RECRUITING'", 't.recruiting=1', "c.status='PUBLISHED'"];
  const params = [];
  if (competitionId) { where.push('t.competition_id=?'); params.push(competitionId); }
  if (keyword) { where.push('(t.name LIKE ? OR t.slogan LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(
    `SELECT COUNT(*) c FROM team t JOIN competition c ON c.id=t.competition_id WHERE ${w}`, params
  );
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT t.id, t.competition_id, c.title AS competition_title, c.level, t.track_id, t.name, t.slogan,
            t.college_code, dc.label AS college_name, t.member_count, t.max_members,
            t.leader_id, lp.real_name AS leader_name, lp.avatar_url AS leader_avatar,
            t.advisor_id, ap.real_name AS advisor_name, t.created_at
     FROM team t
     JOIN competition c ON c.id=t.competition_id
     LEFT JOIN dict_item dc ON dc.type='COLLEGE' AND dc.code=t.college_code
     LEFT JOIN user_profile lp ON lp.account_id=t.leader_id
     LEFT JOIN user_profile ap ON ap.account_id=t.advisor_id
     WHERE ${w} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
}

// ---------- 负责人分配指导老师 ----------
async function assignAdvisor(id, user, advisorId) {
  const t = await getTeam(id);
  if (!t) throw new AppError(404, 'NOT_FOUND', '队伍不存在');
  if (!['MANAGER', 'ADMIN'].includes(user.userType)) throw new AppError(403, 'PERMISSION_DENIED', '仅负责人可分配指导老师');
  const [acc] = await pool.query("SELECT id, display_name FROM account WHERE id=? AND user_type='TEACHER'", [advisorId]);
  if (!acc[0]) throw new AppError(400, 'VALIDATION', '指导老师必须是教师账号');
  await joinAdvisor(id, advisorId, 'ASSIGN', user.id);
  await notify.notify(advisorId, 'TEAM', '被分配为指导老师', `你被负责人分配为「${t.name}」的指导老师`, `/teams/${id}`);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'TEAM_ASSIGN_ADVISOR', module: 'team', resource_type: 'TEAM', resource_id: id, detail: { advisorId } });
  return detail(id, user);
}

module.exports = {
  getTeam, create, detail, update, disband, lock, unlock, transferLeader, leave, removeMember,
  mine, recruiting, assignAdvisor, joinStudent, joinAdvisor, hasActiveTeam,
};
