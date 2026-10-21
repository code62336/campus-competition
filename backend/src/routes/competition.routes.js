const router = require('express').Router();
const competitionService = require('../services/competitionService');
const { authRequired, requireManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

// 公开列表
router.get('/', asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await competitionService.list({ keyword: req.query.keyword, level: req.query.level, year: req.query.year, category: req.query.category, collegeCode: req.query.college_code, page, size, offset });
  paged(res, { items, page, size, total });
}));

// 我组织的赛事（负责人/管理员）
router.get('/mine', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.mine(req.user))));

// 详情
router.get('/:id', asyncHandler(async (req, res) => ok(res, await competitionService.detail(req.params.id))));

// 统计
router.get('/:id/stat', authRequired, asyncHandler(async (req, res) => ok(res, await competitionService.stat(req.user, req.params.id))));

// 创建
router.post('/', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.create(req.user, req.body), 201)));

// 编辑 / 删除
router.patch('/:id', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.update(req.user, req.params.id, req.body))));
router.delete('/:id', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.remove(req.user, req.params.id))));

// 发布 / 下架 / 归档
router.post('/:id/publish', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.publish(req.user, req.params.id))));
router.post('/:id/offline', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.setStatus(req.user, req.params.id, 'OFFLINE', 'COMPETITION_OFFLINE'))));
router.post('/:id/archive', authRequired, requireManager, asyncHandler(async (req, res) => ok(res, await competitionService.setStatus(req.user, req.params.id, 'ARCHIVED', 'COMPETITION_ARCHIVE'))));

module.exports = router;
