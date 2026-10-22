const AppError = require('../utils/AppError');

// 统一错误处理：业务异常(AppError)按原样返回；未知/DB 异常映射为友好文案，不泄露内部细节
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status;
  let code = err.code;
  let message = err.message;

  if (!err.status) {
    if (err.code === 'ER_DUP_ENTRY') { status = 409; code = 'DUPLICATED'; message = '数据已存在，请勿重复提交'; }
    else if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') { status = 400; code = 'VALIDATION'; message = '提交的数据格式不正确'; }
    else { status = 500; code = 'INTERNAL_ERROR'; message = '服务器内部错误'; }
  }

  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ code, message, data: err.extra || null });
};
