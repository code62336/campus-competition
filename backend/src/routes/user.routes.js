const router = require('express').Router();
const profileService = require('../services/profileService');
const dictService = require('../services/dictService');
const { authRequired, requireRole, ROLE } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paged, parsePager } = require('../utils/response');

// 本人档案
router.get('/users/me/profile', authRequired, asyncHandler(async (req, res) => ok(res, await profileService.getMyProfile(req.user.id))));
router.patch('/users/me/profile', authRequired, asyncHandler(async (req, res) => ok(res, await profileService.updateMyProfile(req.user.id, req.body))));

// 身份认证
router.get('/users/me/verification', authRequired, asyncHandler(async (req, res) => ok(res, await profileService.getMyVerification(req.user.id))));
router.post('/users/me/verification', authRequired, asyncHandler(async (req, res) => ok(res, await profileService.submitVerification(req.user.id, req.body))));

// 教师（找老师 / 公开主页）
router.get('/teachers', asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await profileService.listTeachers({ keyword: req.query.keyword, collegeCode: req.query.college_code, page, size, offset });
  paged(res, { items, page, size, total });
}));
router.get('/teachers/:id', asyncHandler(async (req, res) => ok(res, await profileService.getTeacherPublic(req.params.id))));

// 学生（老师挑人 / 公开主页）
router.get('/students/search', authRequired, requireRole(ROLE.STUDENT, ROLE.TEACHER, ROLE.MANAGER, ROLE.ADMIN), asyncHandler(async (req, res) => {
  const { page, size, offset } = parsePager(req.query);
  const { items, total } = await profileService.searchStudents({ keyword: req.query.keyword, collegeCode: req.query.college_code, degreeLevel: req.query.degree_level, skill: req.query.skill, page, size, offset });
  paged(res, { items, page, size, total });
}));
router.get('/students/:id', asyncHandler(async (req, res) => ok(res, await profileService.getStudentPublic(req.params.id))));

// 字典
router.get('/dicts/:type', asyncHandler(async (req, res) => ok(res, await dictService.getByType(req.params.type))));

module.exports = router;
