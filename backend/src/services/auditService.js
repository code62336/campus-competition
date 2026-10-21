const { pool } = require('../config/db');
const { toJson } = require('../utils/helpers');

exports.log = async ({ operator_id, operator_name, action, module, resource_type, resource_id, detail, ip, result = 'SUCCESS' }) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (operator_id, operator_name, action, module, resource_type, resource_id, detail_json, ip, result)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [operator_id || 0, operator_name || null, action, module, resource_type || null, resource_id || null, toJson(detail), ip || null, result]
    );
  } catch (e) {
    console.error('[audit]', e.message);
  }
};
