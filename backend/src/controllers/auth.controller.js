const authService = require('../services/auth.service');

async function register(req, res) {
  const result = await authService.registerUser(req.body);
  res.status(201).json({ success: true, ...result });
}

async function login(req, res) {
  const result = await authService.loginUser(req.body);
  res.json({ success: true, ...result });
}

async function demoLogin(req, res) {
  const { email, name } = req.body || {};
  const result = await authService.demoLogin(email, name);
  res.json({ success: true, ...result });
}

async function getMe(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { register, login, demoLogin, getMe };
