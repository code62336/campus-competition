const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const AppError = require('../utils/AppError');
const { authRequired } = require('../middleware/auth');
const { ok } = require('../utils/response');

if (!fs.existsSync(config.uploadRoot)) fs.mkdirSync(config.uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 32 * 1024 * 1024 } });

router.post('/', authRequired, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(new AppError(400, 'UPLOAD_ERROR', err.message));
    if (!req.file) return next(new AppError(400, 'NO_FILE', '未收到文件'));
    return ok(res, { url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size }, 201);
  });
});

module.exports = router;
