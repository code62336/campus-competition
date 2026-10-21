const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

exports.signAccess = (user) => jwt.sign(
  { sub: String(user.id), userType: user.user_type, displayName: user.display_name },
  config.jwt.secret,
  { expiresIn: config.jwt.accessExpiresIn }
);

exports.verifyAccess = (token) => jwt.verify(token, config.jwt.secret);

exports.genRefreshToken = () => crypto.randomBytes(32).toString('hex');
exports.genFamilyId = () => crypto.randomBytes(16).toString('hex');
exports.sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
