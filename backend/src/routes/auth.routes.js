const router = require('express').Router();
const accountService = require('../services/accountService');
const { authRequired } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

router.post('/register', asyncHandler(async (req, res) => {
  const result = await accountService.register(req.body);
  ok(res, result, 201);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const result = await accountService.login({ username: req.body.username, password: req.body.password, ip: req.ip });
  ok(res, result);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken || (req.headers['x-refresh-token'] || '');
  const result = await accountService.refresh(refreshToken);
  ok(res, result);
}));

router.post('/logout', authRequired, asyncHandler(async (req, res) => {
  await accountService.logout(req.body.refreshToken || '');
  ok(res, true);
}));

router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const result = await accountService.getMe(req.user.id);
  ok(res, result);
}));

router.patch('/password', authRequired, asyncHandler(async (req, res) => {
  await accountService.changePassword(req.user.id, req.body);
  ok(res, true);
}));

router.post('/codes/send', asyncHandler(async (req, res) => {
  const result = await accountService.sendCode({ email: req.body.email, purpose: req.body.purpose || 'RESET_PASSWORD' });
  ok(res, result);
}));

router.post('/password/reset', asyncHandler(async (req, res) => {
  await accountService.resetPassword(req.body);
  ok(res, true);
}));

module.exports = router;
