import { User } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  googleConnected: boolean;
  slackConnected: boolean;
  slackTeamName: string | null;
  slackChannelId: string | null;
  slackNotificationsEnabled: boolean;
  createdAt: Date;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    googleConnected: Boolean(user.googleId),
    slackConnected: Boolean(user.slackAccessToken || user.slackId),
    slackTeamName: user.slackTeamName,
    slackChannelId: user.slackChannelId,
    slackNotificationsEnabled: user.slackNotificationsEnabled,
    createdAt: user.createdAt,
  };
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
