const jobService = require('../services/job.service');

async function scheduleJobs(req, res) {
  const result = await jobService.scheduleEmailJobs(req.user, req.body);
  res.status(result.deduplicated ? 200 : 201).json({
    success: true,
    deduplicated: result.deduplicated,
    message: result.deduplicated
      ? 'Returned existing job for idempotency key'
      : `Scheduled ${result.jobs.length} email job${result.jobs.length === 1 ? '' : 's'}`,
    job:  result.jobs[0],
    jobs: result.jobs,
  });
}

async function listJobs(req, res) {
  const page     = Math.max(1, Number(req.query.page) || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status   = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined;
  const senderId = typeof req.query.senderId === 'string' && req.query.senderId ? req.query.senderId : undefined;

  const result = await jobService.listEmailJobs(req.user.id, { status, senderId, page, limit });
  res.json({ success: true, count: result.items.length, data: result.items, pagination: result.pagination });
}

async function getJob(req, res) {
  const job = await jobService.getEmailJobById(req.user.id, req.params.id);
  res.json({ success: true, data: job });
}

async function rescheduleJob(req, res) {
  const updated = await jobService.rescheduleEmailJob(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: 'Job rescheduled successfully', data: updated });
}

async function cancelJob(req, res) {
  const updated = await jobService.cancelEmailJob(req.user.id, req.params.id);
  res.json({ success: true, message: 'Job cancelled successfully', data: updated });
}

async function searchJobs(req, res) {
  const q      = String(req.query.q || '').trim();
  const page   = Math.max(1, Number(req.query.page) || 1);
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : undefined;

  const result = await jobService.searchEmailJobs(req.user.id, { q, status, page, limit });
  res.json({ success: true, searchEngine: result.searchEngine, count: result.items.length, data: result.items, pagination: result.pagination });
}

module.exports = { scheduleJobs, listJobs, getJob, rescheduleJob, cancelJob, searchJobs };
