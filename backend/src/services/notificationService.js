const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

exports.notify = async (recipient_id, type, title, content, link_url = null) => {
  try {
    await pool.query(
      'INSERT INTO notification (recipient_id, type, title, content, link_url) VALUES (?,?,?,?,?)',
      [recipient_id, type, title, content, link_url]
    );
  } catch (e) {
    console.error('[notify]', e.message);
  }
};

exports.list = async (accountId, { unreadOnly, type, page, size, offset }) => {
  const where = ['recipient_id=?'];
  const params = [accountId];
  if (unreadOnly) where.push('read_at IS NULL');
  if (type) { where.push('type=?'); params.push(type); }
  const w = where.join(' AND ');
  const [cnt] = await pool.query(`SELECT COUNT(*) c FROM notification WHERE ${w}`, params);
  const total = cnt[0].c;
  const [rows] = await pool.query(
    `SELECT id, type, title, content, link_url, read_at, created_at FROM notification WHERE ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  return { items: rows, total };
};

exports.unreadCount = async (accountId) => {
  const [rows] = await pool.query(
    'SELECT type, COUNT(*) c FROM notification WHERE recipient_id=? AND read_at IS NULL GROUP BY type',
    [accountId]
  );
  let total = 0;
  const byType = {};
  for (const r of rows) { byType[r.type] = r.c; total += r.c; }
  return { total, byType };
};

exports.markRead = async (accountId, id) => {
  const [res] = await pool.query('UPDATE notification SET read_at=IFNULL(read_at, NOW(3)) WHERE id=? AND recipient_id=?', [id, accountId]);
  if (res.affectedRows === 0) {
    const [chk] = await pool.query('SELECT recipient_id FROM notification WHERE id=?', [id]);
    if (!chk[0]) throw new AppError(404, 'NOT_FOUND', '通知不存在');
    throw new AppError(403, 'PERMISSION_DENIED', '无权限操作该通知');
  }
  return true;
};

exports.markAllRead = async (accountId) => {
  await pool.query('UPDATE notification SET read_at=IFNULL(read_at, NOW(3)) WHERE recipient_id=? AND read_at IS NULL', [accountId]);
  return true;
};
