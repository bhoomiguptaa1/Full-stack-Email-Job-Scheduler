const jwt = require('jsonwebtoken');
const { ENV } = require('../config/env');
const User = require('../models/User');
const { toSafeUser } = require('../utils/sanitize');
const { AppError } = require('./error.middleware');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication token required', 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new AppError(401, 'Authentication token required', 'UNAUTHORIZED');

    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) throw new AppError(401, 'User account not found', 'UNAUTHORIZED');

    req.user = toSafeUser(user);
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, 'Invalid or expired authentication token', 'UNAUTHORIZED'));
  }
}

module.exports = { requireAuth };
