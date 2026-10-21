const app = require('./app');
const config = require('./config');
const { pool } = require('./config/db');

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] 已连接 MySQL');
  } catch (e) {
    console.error('[DB] 连接失败，请检查 .env 中的数据库配置：', e.message);
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`[server] 高校赛事管理系统后端已启动： http://localhost:${config.port}`);
  });
}

start();
