const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool(config.db);

// 事务包装器：fn(conn) 内执行多语句
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, withTransaction, db: pool };
