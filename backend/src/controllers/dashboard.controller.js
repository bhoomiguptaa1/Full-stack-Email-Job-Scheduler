const { getDashboardStats } = require('../services/job.service');
const { ensureDefaultSender } = require('../services/sender.service');

async function getStats(req, res) {
  await ensureDefaultSender(req.user.id, req.user.email, req.user.name);
  const stats = await getDashboardStats(req.user.id);
  res.json({ success: true, data: stats });
}

module.exports = { getStats };
