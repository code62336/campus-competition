const router = require('express').Router();
const adminService = require('../services/adminService');
const competitionService = require('../services/competitionService');
const { authRequired, requireAdmin, requireManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

// 仪表盘统计
router.get('/stats', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await adminService.stats())));

// 用户管理
router.get('/users', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await adminService.listUsers({ keyword: req.query.keyword, userType: req.query.user_type, status: req.query.status, page, size, offset });
  paged(res, { items, page, size, total });
}));
router.patch('/users/:id/status', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.setUserStatus(req.user, req.params.id, req.body.status))));
router.post('/users/:id/password/reset', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.resetPassword(req.user, req.params.id, req.body.newPassword))));
router.post('/users', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.createUser(req.user, req.body), 201)));

// 认证审核
router.get('/verifications', authRequired, requireManager, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await adminService.listVerifications({ status: req.query.status, page, size, offset });
  paged(res, { items, page, size, total });
}));
router.post('/verifications/:id/review', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await adminService.reviewVerification(req.user, req.params.id, req.body))));

// 赛事管理（负责人视角：本人创建的；管理员：全部）
router.get('/competitions', authRequired, requireManager, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await competitionService.listForAdmin({ keyword: req.query.keyword, status: req.query.status, page, size, offset, user: req.user });
  paged(res, { items, page, size, total });
}));

// 字典管理
router.get('/dicts', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.listDicts(req.query.type))));
router.put('/dicts', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.saveDict(req.user, req.body))));
router.delete('/dicts/:id', authRequired, requireAdmin, asyncHandler(async (req, res) => ok(res, await adminService.deleteDict(req.user, req.params.id))));

// 审计日志
router.get('/audit-logs', authRequired, requireAdmin, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await adminService.listAuditLogs({ action: req.query.action, operatorId: req.query.operator_id, page, size, offset });
  paged(res, { items, page, size, total });
}));

module.exports = router;
