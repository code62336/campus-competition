const { verifyAccess } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const { ROLE } = require('../config');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', '未登录或登录已过期'));
  try {
    const payload = verifyAccess(token);
    req.user = { id: Number(payload.sub), userType: payload.userType, displayName: payload.displayName };
    next();
  } catch (e) {
    return next(new AppError(401, 'TOKEN_EXPIRED', '登录已过期，请重新登录'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', '未登录'));
    if (!roles.includes(req.user.userType)) {
      return next(new AppError(403, 'PERMISSION_DENIED', '无权限执行此操作'));
    }
    next();
  };
}

const requireManager = requireRole(ROLE.MANAGER, ROLE.ADMIN);
const requireAdmin = requireRole(ROLE.ADMIN);

module.exports = { authRequired, requireRole, requireManager, requireAdmin, ROLE };
