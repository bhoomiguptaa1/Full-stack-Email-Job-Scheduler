import { WebClient } from '@slack/web-api';
import { prisma } from '../config/db';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export type SlackEventType = 'COMPLETED' | 'FAILED' | 'RATE_LIMITED' | 'QUEUE_ERROR';

export interface SlackJobNotification {
  event: SlackEventType;
  jobId: string;
  recipientEmail: string;
  subject: string;
  details?: string;
  previewUrl?: string | null;
}

function buildSlackText(payload: SlackJobNotification): string {
  const headerMap: Record<SlackEventType, string> = {
    COMPLETED: '[ReachInbox] Email Delivered',
    FAILED: '[ReachInbox] Email Delivery Failed',
    RATE_LIMITED: '[ReachInbox] Sender Hourly Rate Limit Reached',
    QUEUE_ERROR: '[ReachInbox] Queue Worker Alert',
  };

  const parts = [
    `*${headerMap[payload.event]}*`,
    `• *Subject:* ${payload.subject}`,
    `• *Recipient:* ${payload.recipientEmail}`,
    `• *Job ID:* \`${payload.jobId}\``,
  ];

  if (payload.details) {
    parts.push(`• *Details:* ${payload.details}`);
  }
  if (payload.previewUrl) {
    parts.push(`• *Preview:* <${payload.previewUrl}|View in Ethereal>`);
  }

  return parts.join('\n');
}

export async function notifySlackJobEvent(
  userId: string | undefined,
  payload: SlackJobNotification
): Promise<void> {
  const text = buildSlackText(payload);

  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          slackAccessToken: true,
          slackChannelId: true,
          slackNotificationsEnabled: true,
        },
      });

      if (user?.slackNotificationsEnabled && user.slackAccessToken && user.slackChannelId) {
        const client = new WebClient(user.slackAccessToken);
        await client.chat.postMessage({
          channel: user.slackChannelId,
          text,
        });
        return;
      }
    }

    if (ENV.SLACK_WEBHOOK_URL) {
      await fetch(ENV.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }
  } catch (error) {
    logger.warn('[Slack] Notification delivery warning', {
      event: payload.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function listUserSlackChannels(
  userId: string
): Promise<Array<{ id: string; name: string; isPrivate: boolean }>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { slackAccessToken: true },
  });

  if (!user?.slackAccessToken) {
    return [];
  }

  const client = new WebClient(user.slackAccessToken);
  const res = await client.conversations.list({
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit: 100,
  });

  return (res.channels || [])
    .filter((ch) => Boolean(ch.id && ch.name))
    .map((ch) => ({
      id: ch.id!,
      name: ch.name!,
      isPrivate: Boolean(ch.is_private),
    }));
}
