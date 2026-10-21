const { pool } = require('../config/db');

exports.getByType = async (type, { includeDisabled = false } = {}) => {
  const where = includeDisabled ? 'type = ?' : 'type = ? AND enabled = 1';
  const [rows] = await pool.query(`SELECT id, type, code, label, sort, parent_code FROM dict_item WHERE ${where} ORDER BY sort ASC, id ASC`, [type]);
  return rows;
};

exports.getByTypes = async (types) => {
  if (!types || !types.length) return {};
  const placeholders = types.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, type, code, label, sort, parent_code FROM dict_item WHERE type IN (${placeholders}) AND enabled = 1 ORDER BY sort ASC, id ASC`,
    types
  );
  const map = {};
  for (const r of rows) (map[r.type] = map[r.type] || []).push(r);
  return map;
};
