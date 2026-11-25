import { Request, Response } from 'express';
import * as senderService from '../services/sender.service';

export async function listSenders(req: Request, res: Response): Promise<void> {
  await senderService.ensureDefaultSender(req.user!.id, req.user!.email, req.user!.name);
  const senders = await senderService.listSendersWithUsage(req.user!.id);
  res.json({ success: true, data: senders });
}

export async function createSender(req: Request, res: Response): Promise<void> {
  const sender = await senderService.createSender(req.user!.id, req.body);
  res.status(201).json({ success: true, data: sender });
}

export async function updateSender(req: Request, res: Response): Promise<void> {
  const sender = await senderService.updateSender(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data: sender });
}

export async function deleteSender(req: Request, res: Response): Promise<void> {
  await senderService.deleteSender(req.user!.id, req.params.id);
  res.json({ success: true, message: 'Sender account deleted' });
}
