const senderService = require('../services/sender.service');

async function listSenders(req, res) {
  await senderService.ensureDefaultSender(req.user.id, req.user.email, req.user.name);
  const senders = await senderService.listSendersWithUsage(req.user.id);
  res.json({ success: true, data: senders });
}

async function createSender(req, res) {
  const sender = await senderService.createSender(req.user.id, req.body);
  res.status(201).json({ success: true, data: sender });
}

async function updateSender(req, res) {
  const sender = await senderService.updateSender(req.user.id, req.params.id, req.body);
  res.json({ success: true, data: sender });
}

async function deleteSender(req, res) {
  await senderService.deleteSender(req.user.id, req.params.id);
  res.json({ success: true, message: 'Sender account deleted' });
}

module.exports = { listSenders, createSender, updateSender, deleteSender };
