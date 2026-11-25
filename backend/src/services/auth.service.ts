import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { WebClient } from '@slack/web-api';
import { User } from '@prisma/client';
import { prisma } from '../config/db';
import { ENV } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { normalizeEmail, SafeUser, toSafeUser } from '../utils/sanitize';
import { ensureDefaultSender } from './sender.service';

const googleClient = new OAuth2Client(
  ENV.GOOGLE_CLIENT_ID || undefined,
  ENV.GOOGLE_CLIENT_SECRET || undefined,
  ENV.GOOGLE_REDIRECT_URI
);

export function signUserToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function isConfiguredSecret(val: string, placeholderPrefix: string): boolean {
  return Boolean(val) && !val.startsWith(placeholderPrefix);
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ token: string; user: SafeUser }> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists.', 'EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || email.split('@')[0],
      passwordHash,
      role: 'USER',
    },
  });

  await ensureDefaultSender(user.id, user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: SafeUser }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  await ensureDefaultSender(user.id, user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

export async function demoLogin(
  email = 'evaluator@reachinbox.test',
  name = 'ReachInbox Evaluator'
): Promise<{ token: string; user: SafeUser }> {
  const normalized = normalizeEmail(email);
  let user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalized,
        name,
        role: 'ADMIN',
      },
    });
  }

  await ensureDefaultSender(user.id, user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

export function getOAuthUrls(userId?: string) {
  const googleConfigured =
    isConfiguredSecret(ENV.GOOGLE_CLIENT_ID, 'your_google') &&
    isConfiguredSecret(ENV.GOOGLE_CLIENT_SECRET, 'your_google');

  const slackConfigured =
    isConfiguredSecret(ENV.SLACK_CLIENT_ID, 'your_slack') &&
    isConfiguredSecret(ENV.SLACK_CLIENT_SECRET, 'your_slack');

  const stateToken = jwt.sign(
    { purpose: 'oauth', userId: userId || null },
    ENV.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const googleUrl = googleConfigured
    ? googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'profile', 'email'],
        state: stateToken,
        prompt: 'select_account',
      })
    : null;

  const slackUrl = slackConfigured
    ? `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
        ENV.SLACK_CLIENT_ID
      )}&scope=chat:write,channels:read,groups:read&user_scope=identity.basic,identity.email&redirect_uri=${encodeURIComponent(
        ENV.SLACK_REDIRECT_URI
      )}&state=${encodeURIComponent(stateToken)}`
    : null;

  return {
    googleConfigured,
    slackConfigured,
    googleUrl,
    slackUrl,
  };
}

export async function handleGoogleOAuthCallback(
  code: string,
  state?: string
): Promise<{ token: string; user: SafeUser }> {
  if (!isConfiguredSecret(ENV.GOOGLE_CLIENT_ID, 'your_google')) {
    throw new AppError(400, 'Google OAuth is not configured on the server.', 'OAUTH_NOT_CONFIGURED');
  }

  if (state) {
    jwt.verify(state, ENV.JWT_SECRET);
  }

  const { tokens } = await googleClient.getToken(code);
  if (!tokens.id_token) {
    throw new AppError(401, 'Google did not return a valid ID token.', 'GOOGLE_AUTH_FAILED');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: ENV.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError(401, 'Google account email could not be verified.', 'GOOGLE_AUTH_FAILED');
  }

  const email = normalizeEmail(payload.email);
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: payload.name || email.split('@')[0],
        avatarUrl: payload.picture || null,
        googleId: payload.sub,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: payload.sub,
        name: user.name || payload.name || null,
        avatarUrl: payload.picture || user.avatarUrl,
      },
    });
  }

  await ensureDefaultSender(user.id, user.email, user.name);
  return { token: signUserToken(user), user: toSafeUser(user) };
}

export async function handleSlackOAuthCallback(
  code: string,
  state?: string
): Promise<SafeUser> {
  if (!isConfiguredSecret(ENV.SLACK_CLIENT_ID, 'your_slack')) {
    throw new AppError(400, 'Slack OAuth is not configured on the server.', 'OAUTH_NOT_CONFIGURED');
  }

  let userId: string | null = null;
  if (state) {
    const decoded = jwt.verify(state, ENV.JWT_SECRET) as { userId?: string | null };
    userId = decoded.userId || null;
  }

  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: ENV.SLACK_CLIENT_ID,
    client_secret: ENV.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: ENV.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token) {
    throw new AppError(401, 'Slack OAuth token exchange failed.', 'SLACK_AUTH_FAILED');
  }

  const slackUserId = response.authed_user?.id;
  const teamName = response.team?.name || 'Slack Workspace';

  if (!userId && slackUserId) {
    const existing = await prisma.user.findUnique({ where: { slackId: slackUserId } });
    userId = existing?.id || null;
  }

  if (!userId) {
    throw new AppError(
      400,
      'Please sign in to ReachInbox before connecting Slack.',
      'SLACK_LINK_REQUIRES_AUTH'
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      slackId: slackUserId || undefined,
      slackAccessToken: response.access_token,
      slackTeamName: teamName,
      slackNotificationsEnabled: true,
    },
  });

  return toSafeUser(updated);
}

export async function updateUserSlackSettings(
  userId: string,
  input: { slackChannelId?: string | null; slackNotificationsEnabled?: boolean }
): Promise<SafeUser> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.slackChannelId !== undefined ? { slackChannelId: input.slackChannelId } : {}),
      ...(input.slackNotificationsEnabled !== undefined
        ? { slackNotificationsEnabled: input.slackNotificationsEnabled }
        : {}),
    },
  });
  return toSafeUser(updated);
}
