const AppError = require('../utils/AppError');

// 统一错误处理中间件
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || '服务器内部错误';
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ code, message, data: err.extra || null });
};
