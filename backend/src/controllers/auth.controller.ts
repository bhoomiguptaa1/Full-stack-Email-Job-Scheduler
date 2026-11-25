import { Request, Response } from 'express';
import { ENV } from '../config/env';
import * as authService from '../services/auth.service';
import * as slackService from '../services/slack.service';
import { AppError } from '../middleware/error.middleware';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.registerUser(req.body);
  res.status(201).json({ success: true, ...result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.loginUser(req.body);
  res.json({ success: true, ...result });
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  const { email, name } = req.body || {};
  const result = await authService.demoLogin(email, name);
  res.json({ success: true, ...result });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ success: true, user: req.user });
}

export async function getOAuthUrls(req: Request, res: Response): Promise<void> {
  const urls = authService.getOAuthUrls(req.user?.id);
  res.json({ success: true, ...urls });
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code) {
    throw new AppError(400, 'Missing Google authorization code.', 'MISSING_OAUTH_CODE');
  }
  const result = await authService.handleGoogleOAuthCallback(code, state);
  const redirectUrl = `${ENV.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(result.token)}`;
  res.redirect(redirectUrl);
}

export async function slackCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code) {
    throw new AppError(400, 'Missing Slack authorization code.', 'MISSING_OAUTH_CODE');
  }
  await authService.handleSlackOAuthCallback(code, state);
  res.redirect(`${ENV.FRONTEND_URL}/settings?slack=connected`);
}

export async function listSlackChannels(req: Request, res: Response): Promise<void> {
  const channels = await slackService.listUserSlackChannels(req.user!.id);
  res.json({ success: true, data: channels });
}

export async function updateSlackSettings(req: Request, res: Response): Promise<void> {
  const user = await authService.updateUserSlackSettings(req.user!.id, req.body);
  res.json({ success: true, user });
}
