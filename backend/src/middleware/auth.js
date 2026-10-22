const { pool } = require('../config/db');
const { verifyAccess } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLE } = require('../config');

// 账号状态内存缓存（60s TTL），避免每请求查库；禁用/改状态时主动失效
const statusCache = new Map();
const CACHE_TTL = 60 * 1000;

async function getAccountStatus(accountId) {
  const cached = statusCache.get(accountId);
  if (cached && Date.now() < cached.exp) return cached;
  const [rows] = await pool.query('SELECT status, user_type, display_name FROM account WHERE id=?', [accountId]);
  if (!rows[0]) return null;
  const entry = { status: rows[0].status, userType: rows[0].user_type, displayName: rows[0].display_name, exp: Date.now() + CACHE_TTL };
  statusCache.set(accountId, entry);
  return entry;
}

function clearStatusCache(accountId) { statusCache.delete(accountId); }

function parseToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// 必须用 asyncHandler 包装：Express 4 不捕获 async 中间件的 reject，否则 DB 抖动会导致请求挂起/进程退出
const authRequired = asyncHandler(async (req, res, next) => {
  const token = parseToken(req);
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', '未登录或登录已过期');
  let payload;
  try {
    payload = verifyAccess(token);
  } catch (e) {
    throw new AppError(401, 'TOKEN_EXPIRED', '登录已过期，请重新登录');
  }
  const acc = await getAccountStatus(Number(payload.sub));
  if (!acc || acc.status !== 'ACTIVE') throw new AppError(401, 'ACCOUNT_INVALID', '账号不可用，请重新登录');
  // 以数据库为准的 user_type/status，禁用与改角色即时生效
  req.user = { id: Number(payload.sub), userType: acc.userType, displayName: acc.displayName };
  next();
});

// 可选鉴权：带了合法 token 就注入 user，否则放行（公开接口使用）；内部已 try/catch 兜底
async function optionalAuth(req, res, next) {
  const token = parseToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccess(token);
    const acc = await getAccountStatus(Number(payload.sub));
    if (acc && acc.status === 'ACTIVE') {
      req.user = { id: Number(payload.sub), userType: acc.userType, displayName: acc.displayName };
    }
  } catch (e) { /* 忽略，按未登录处理 */ }
  next();
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

module.exports = { authRequired, optionalAuth, requireRole, requireManager, requireAdmin, ROLE, clearStatusCache };
