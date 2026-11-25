import { Request, Response } from 'express';
import { getDashboardStats } from '../services/job.service';
import { ensureDefaultSender } from '../services/sender.service';

export async function getStats(req: Request, res: Response): Promise<void> {
  await ensureDefaultSender(req.user!.id, req.user!.email, req.user!.name);
  const stats = await getDashboardStats(req.user!.id);
  res.json({ success: true, data: stats });
}
