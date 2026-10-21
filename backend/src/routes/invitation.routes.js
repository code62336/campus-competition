const router = require('express').Router();
const invitationService = require('../services/invitationService');
const { authRequired } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

// 发起邀请
router.post('/', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.create(req.user, req.body), 201)));

// 邀请列表
router.get('/', authRequired, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await invitationService.list(req.user, { direction: req.query.direction || 'in', status: req.query.status, page, size, offset });
  paged(res, { items, page, size, total });
}));

// 接受 / 拒绝 / 撤回
router.post('/:id/accept', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.accept(req.params.id, req.user))));
router.post('/:id/reject', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.reject(req.params.id, req.user, req.body.reason))));
router.post('/:id/cancel', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.cancel(req.params.id, req.user))));

// 入队申请
router.post('/join-requests', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.createJoinRequest(req.user, req.body), 201)));
router.get('/join-requests', authRequired, asyncHandler(async (req, res) => {
  const { items, total } = await invitationService.listJoinRequests(req.user);
  paged(res, { items, page: 1, size: 100, total });
}));
router.post('/join-requests/:id/approve', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.accept(req.params.id, req.user))));
router.post('/join-requests/:id/reject', authRequired, asyncHandler(async (req, res) => ok(res, await invitationService.reject(req.params.id, req.user, req.body.reason))));

module.exports = router;
