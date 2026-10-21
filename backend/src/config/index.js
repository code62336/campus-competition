require('dotenv').config();
const path = require('path');

module.exports = {
  port: +(process.env.PORT || 8080),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tzb',
    waitForConnections: true,
    connectionLimit: 12,
    charset: 'utf8mb4',
    dateStrings: true,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'tzb-dev-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '2h',
    refreshExpiresInDays: 7,
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  uploadRoot: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
};

// 角色常量与权限码（前端 UI 控制用）
module.exports.ROLE = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
};

module.exports.ROLE_PERMISSIONS = {
  STUDENT: ['team:create', 'team:read', 'invitation:create', 'invitation:respond', 'profile:update', 'notification:read'],
  TEACHER: ['student:search', 'team:read', 'invitation:create', 'invitation:respond', 'profile:update', 'notification:read'],
  MANAGER: ['competition:manage', 'verification:review', 'team:manage', 'student:read', 'team:read', 'profile:update', 'notification:read'],
  ADMIN: ['*'],
};
