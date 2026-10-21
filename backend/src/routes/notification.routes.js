const router = require('express').Router();
const notificationService = require('../services/notificationService');
const { authRequired } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await notificationService.list(req.user.id, { unreadOnly: req.query.unread_only === '1', type: req.query.type, page, size, offset });
  paged(res, { items, page, size, total });
}));

router.get('/unread-count', authRequired, asyncHandler(async (req, res) => ok(res, await notificationService.unreadCount(req.user.id))));

router.post('/:id/read', authRequired, asyncHandler(async (req, res) => ok(res, await notificationService.markRead(req.user.id, req.params.id))));
router.post('/read-all', authRequired, asyncHandler(async (req, res) => ok(res, await notificationService.markAllRead(req.user.id))));

module.exports = router;
