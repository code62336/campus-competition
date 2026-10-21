const { pool, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { fromJson, toJson, toDateTime, nowStr } = require('../utils/helpers');
const audit = require('./auditService');

function normalize(c) {
  if (!c) return c;
  c.tracks = fromJson(c.tracks_json);
  delete c.tracks_json;
  return c;
}

function isOwner(c, user) {
  return user && (user.userType === 'ADMIN' || c.created_by === user.id);
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM competition WHERE id=?', [id]);
  return rows[0] || null;
}

// 组队窗口是否开启
function windowOpen(c) {
  const now = nowStr();
  return c.register_start_at <= now && c.register_end_at >= now;
}

async function attachStat(id) {
  const [teamCnt] = await pool.query('SELECT COUNT(*) c FROM team WHERE competition_id=? AND status<>\'DISBANDED\'', [id]);
  return { teamCount: teamCnt[0].c };
}

// ---------- 公开列表 ----------
async function list({ keyword, level, year, category, collegeCode, page, size, offset }) {
  const where = ["status='PUBLISHED'"];
  const params = [];
  if (keyword) { where.push('(title LIKE ? OR organizer LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (level) { where.push('level=?'); params.push(level); }
  if (year) { where.push('year=?'); params.push(year); }
  if (category) { where.push('category=?'); params.push(category); }
  if (collegeCode) { where.push('college_code=?'); params.push(collegeCode); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM competition WHERE ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT id, code, title, subtitle, level, college_code, year, category, organizer, cover_url,
            register_start_at, register_end_at, min_team_size, max_team_size, published_at
     FROM competition WHERE ${w} ORDER BY register_end_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
}

async function detail(id) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (c.status === 'DRAFT') throw new AppError(404, 'NOT_FOUND', '赛事尚未发布');
  const stat = await attachStat(id);
  return { ...normalize(c), register_open: windowOpen(c), ...stat };
}

// ---------- 管理端 ----------
async function listForAdmin({ keyword, status, page, size, offset, user }) {
  const where = [];
  const params = [];
  if (user.userType !== 'ADMIN') { where.push('created_by=?'); params.push(user.id); }
  if (keyword) { where.push('(title LIKE ? OR code LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (status) { where.push('status=?'); params.push(status); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM competition ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT * FROM competition ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows.map(normalize), total };
}

async function mine(user) {
  const where = user.userType === 'ADMIN' ? '' : 'WHERE created_by=?';
  const params = user.userType === 'ADMIN' ? [] : [user.id];
  const [rows] = await pool.query(
    `SELECT id, code, title, subtitle, level, year, category, status, register_start_at, register_end_at, cover_url, published_at
     FROM competition ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

async function create(user, data) {
  const { title, level, year, registerStartAt, registerEndAt } = data;
  if (!title || !level || !year || !registerStartAt || !registerEndAt) {
    throw new AppError(400, 'VALIDATION', '赛事名称、级别、年份、组队起止时间为必填');
  }
  const code = data.code || `TZB${year}-${Date.now().toString(36).toUpperCase()}`;
  const [dup] = await pool.query('SELECT id FROM competition WHERE code=?', [code]);
  if (dup[0]) throw new AppError(409, 'CODE_EXISTS', '赛事编码已存在');

  const res = await pool.query(
    `INSERT INTO competition
      (code, title, subtitle, level, college_code, year, category, organizer, official_url, description_md, cover_url,
       tracks_json, register_start_at, register_end_at, status, min_team_size, max_team_size, teacher_required,
       max_teacher_count, max_teams_per_teacher, allow_cross_college, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(3))`,
    [
      code, title, data.subtitle || null, level, data.collegeCode || null, year, data.category || null,
      data.organizer || null, data.officialUrl || null, data.descriptionMd || null, data.coverUrl || null,
      toJson(data.tracks || []), toDateTime(registerStartAt), toDateTime(registerEndAt), 'DRAFT',
      data.minTeamSize || 3, data.maxTeamSize || 8, data.teacherRequired === undefined ? 1 : (data.teacherRequired ? 1 : 0),
      data.maxTeacherCount || 2, data.maxTeamsPerTeacher || 3, data.allowCrossCollege === undefined ? 1 : (data.allowCrossCollege ? 1 : 0),
      user.id,
    ]
  );
  const id = res[0].insertId;
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'COMPETITION_CREATE', module: 'comp', resource_type: 'COMPETITION', resource_id: id });
  return normalize(await findById(id));
}

async function update(user, id, data) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (!isOwner(c, user)) throw new AppError(403, 'PERMISSION_DENIED', '无权限编辑该赛事');
  if (c.status === 'ARCHIVED') throw new AppError(409, 'COMPETITION_ARCHIVED', '赛事已归档，不可编辑');

  const fields = ['title', 'subtitle', 'level', 'college_code', 'year', 'category', 'organizer', 'official_url', 'description_md', 'cover_url'];
  const sets = [];
  const values = [];
  const map = { title: 'title', subtitle: 'subtitle', level: 'level', collegeCode: 'college_code', year: 'year', category: 'category', organizer: 'organizer', officialUrl: 'official_url', descriptionMd: 'description_md', coverUrl: 'cover_url' };
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) { sets.push(`${col}=?`); values.push(data[k]); }
  }
  if (data.registerStartAt) { sets.push('register_start_at=?'); values.push(toDateTime(data.registerStartAt)); }
  if (data.registerEndAt) { sets.push('register_end_at=?'); values.push(toDateTime(data.registerEndAt)); }
  if (data.tracks) { sets.push('tracks_json=?'); values.push(toJson(data.tracks)); }
  for (const [k, col] of [['minTeamSize', 'min_team_size'], ['maxTeamSize', 'max_team_size'], ['teacherRequired', 'teacher_required'], ['maxTeacherCount', 'max_teacher_count'], ['maxTeamsPerTeacher', 'max_teams_per_teacher'], ['allowCrossCollege', 'allow_cross_college']]) {
    if (data[k] !== undefined) { sets.push(`${col}=?`); values.push(typeof data[k] === 'boolean' ? (data[k] ? 1 : 0) : data[k]); }
  }
  if (!sets.length) throw new AppError(400, 'VALIDATION', '没有可更新的字段');
  values.push(id);
  await pool.query(`UPDATE competition SET ${sets.join(', ')} WHERE id=?`, values);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'COMPETITION_UPDATE', module: 'comp', resource_type: 'COMPETITION', resource_id: id });
  return normalize(await findById(id));
}

async function remove(user, id) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (!isOwner(c, user)) throw new AppError(403, 'PERMISSION_DENIED', '无权限删除');
  if (c.status !== 'DRAFT') throw new AppError(409, 'STATE_CONFLICT', '仅草稿状态可删除');
  await pool.query('DELETE FROM competition WHERE id=?', [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'COMPETITION_DELETE', module: 'comp', resource_type: 'COMPETITION', resource_id: id });
  return true;
}

async function publish(user, id) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (!isOwner(c, user)) throw new AppError(403, 'PERMISSION_DENIED', '无权限发布');
  const tracks = fromJson(c.tracks_json) || [];
  if (!tracks.length) throw new AppError(400, 'NO_TRACK', '请至少配置一个赛道');
  if (!c.register_start_at || !c.register_end_at) throw new AppError(400, 'NO_WINDOW', '请配置组队时间窗口');
  if (c.register_end_at <= c.register_start_at) throw new AppError(400, 'BAD_WINDOW', '截止时间必须晚于开始时间');
  await pool.query("UPDATE competition SET status='PUBLISHED', published_at=NOW(3) WHERE id=?", [id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action: 'COMPETITION_PUBLISH', module: 'comp', resource_type: 'COMPETITION', resource_id: id });
  return normalize(await findById(id));
}

async function setStatus(user, id, status, action) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (!isOwner(c, user)) throw new AppError(403, 'PERMISSION_DENIED', '无权限操作');
  if (status === 'OFFLINE' && c.status !== 'PUBLISHED') throw new AppError(409, 'STATE_CONFLICT', '仅已发布赛事可下架');
  await pool.query(`UPDATE competition SET status=?${status === 'ARCHIVED' ? ', archived_at=NOW(3)' : ''} WHERE id=?`, [status, id]);
  await audit.log({ operator_id: user.id, operator_name: user.displayName, action, module: 'comp', resource_type: 'COMPETITION', resource_id: id });
  return normalize(await findById(id));
}

async function stat(user, id) {
  const c = await findById(id);
  if (!c) throw new AppError(404, 'NOT_FOUND', '赛事不存在');
  if (c.status === 'DRAFT' && !isOwner(c, user)) throw new AppError(403, 'PERMISSION_DENIED', '无权查看');
  const [total] = await pool.query('SELECT COUNT(*) c FROM team WHERE competition_id=? AND status<>\'DISBANDED\'', [id]);
  const [byTrack] = await pool.query(
    'SELECT track_id, COUNT(*) c FROM team WHERE competition_id=? AND status<>\'DISBANDED\' GROUP BY track_id', [id]
  );
  const [byCollege] = await pool.query(
    'SELECT college_code, COUNT(*) c FROM team WHERE competition_id=? AND status<>\'DISBANDED\' GROUP BY college_code', [id]
  );
  const [locked] = await pool.query('SELECT COUNT(*) c FROM team WHERE competition_id=? AND status=\'LOCKED\'', [id]);
  const tracks = fromJson(c.tracks_json) || [];
  return {
    teamCount: total[0].c,
    lockedCount: locked[0].c,
    trackDistribution: byTrack.map((t) => {
      const tr = tracks.find((x) => x.id === t.track_id);
      return { trackId: t.track_id, trackName: tr ? tr.name : (t.track_id == null ? '未选赛道' : `赛道#${t.track_id}`), count: t.c };
    }),
    collegeDistribution: byCollege.map((x) => ({ collegeCode: x.college_code, count: x.c })),
  };
}

module.exports = { list, detail, listForAdmin, mine, create, update, remove, publish, setStatus, stat, findById, normalize, windowOpen };
