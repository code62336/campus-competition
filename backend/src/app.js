const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/error');

const app = express();

// 仅允许本地来源，避免跨域被滥用（前端经 vite 代理同源访问，正常无需 CORS）
app.use(cors({ origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 上传文件静态访问：禁止按脚本执行
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(config.uploadRoot));

// 健康检查
app.get('/api/v1/health', (req, res) => res.json({ code: 0, message: 'ok', data: { status: 'up', time: new Date().toISOString() } }));

// 路由挂载
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1', require('./routes/user.routes'));
app.use('/api/v1/competitions', require('./routes/competition.routes'));
app.use('/api/v1/teams', require('./routes/team.routes'));
app.use('/api/v1/invitations', require('./routes/invitation.routes'));
app.use('/api/v1/notifications', require('./routes/notification.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes'));
app.use('/api/v1/files', require('./routes/file.routes'));

// 404
app.use((req, res) => res.status(404).json({ code: 'NOT_FOUND', message: '接口不存在', data: null }));

// 统一错误处理
app.use(errorHandler);

module.exports = app;
