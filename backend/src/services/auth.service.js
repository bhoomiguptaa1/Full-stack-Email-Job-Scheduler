const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ENV } = require('../config/env');
const { AppError } = require('../middleware/error.middleware');
const { normalizeEmail, toSafeUser } = require('../utils/sanitize');
const { ensureDefaultSender } = require('./sender.service');

function signUserToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, email: user.email, role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function registerUser({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new AppError(409, 'An account with this email already exists.', 'EMAIL_IN_USE');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split('@')[0],
    passwordHash,
    role: 'USER',
  });

  await ensureDefaultSender(String(user._id), user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.passwordHash) throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');

  await ensureDefaultSender(String(user._id), user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

async function demoLogin(email = 'evaluator@reachinbox.test', name = 'ReachInbox Evaluator') {
  const normalizedEmail = normalizeEmail(email);
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = await User.create({ email: normalizedEmail, name, role: 'ADMIN' });
  }
  await ensureDefaultSender(String(user._id), user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

module.exports = { registerUser, loginUser, demoLogin, signUserToken };
