const router = require('express').Router();
const teamService = require('../services/teamService');
const { authRequired, requireManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

// 建队
router.post('/', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.create(req.user, req.body), 201)));

// 我的队伍
router.get('/mine', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.mine(req.user))));

// 找队友广场
router.get('/recruiting', asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await teamService.recruiting({ competitionId: req.query.competition_id, keyword: req.query.keyword, page, size, offset });
  paged(res, { items, page, size, total });
}));

// 详情 / 更新 / 解散
router.get('/:id', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.detail(req.params.id, req.user))));
router.patch('/:id', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.update(req.params.id, req.user, req.body))));
router.delete('/:id', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.disband(req.params.id, req.user))));

// 锁定 / 解锁
router.post('/:id/lock', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await teamService.lock(req.params.id, req.user))));
router.post('/:id/unlock', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await teamService.unlock(req.params.id, req.user))));

// 转让队长 / 退出 / 移出
router.post('/:id/transfer-leader', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.transferLeader(req.params.id, req.user, req.body.newLeaderId))));
router.post('/:id/leave', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.leave(req.params.id, req.user))));
router.delete('/:id/members/:accountId', authRequired, asyncHandler(async (req, res) => ok(res, await teamService.removeMember(req.params.id, req.user, req.params.accountId))));

// 负责人分配指导老师
router.post('/:id/advisors', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await teamService.assignAdvisor(req.params.id, req.user, req.body.advisorId))));

module.exports = router;
