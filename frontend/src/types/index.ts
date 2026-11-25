export type JobStatus =
  | 'SCHEDULED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type RecurrenceType =
  | 'NONE'
  | 'EVERY_HOUR'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'CUSTOM_REPEAT';

export interface User {
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
  createdAt: string;
}

export interface SenderUsage {
  sentThisHour: number;
  hourlyLimit: number;
  remaining: number;
  resetAt: string;
}

export interface SenderAccount {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  hourlyLimit: number;
  minDelayMs: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  usage: SenderUsage;
}

export interface EmailJobLog {
  id: string;
  jobId: string;
  event: string;
  message: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export interface EmailJob {
  id: string;
  jobId?: string;
  userId: string;
  senderId?: string | null;
  senderEmail?: string | null;
  sender?: {
    id: string;
    email: string;
    name: string | null;
    hourlyLimit: number;
    isActive?: boolean;
  } | null;
  recipientEmail: string;
  subject: string;
  body: string;
  status: JobStatus;
  scheduledFor: string;
  delayMs?: number;
  recurrence: RecurrenceType;
  repeatIntervalMs?: number | null;
  sentAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  retryCount?: number;
  maxRetries?: number;
  rateLimitedCount?: number;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: EmailJobLog[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QueueMetrics {
  connected: boolean;
  isPaused: boolean;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface DashboardStats {
  summary: {
    total: number;
    scheduled: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    activeSenders: number;
    totalSenders: number;
  };
  queue: QueueMetrics;
  senders: SenderAccount[];
  upcomingJobs: Array<{
    id: string;
    recipientEmail: string;
    senderEmail: string | null;
    subject: string;
    status: JobStatus;
    scheduledFor: string;
    recurrence: RecurrenceType;
  }>;
  recentJobs: Array<{
    id: string;
    recipientEmail: string;
    senderEmail: string | null;
    subject: string;
    status: JobStatus;
    scheduledFor: string;
    sentAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    previewUrl: string | null;
    updatedAt: string;
  }>;
}

export interface OAuthUrlsResponse {
  googleConfigured: boolean;
  slackConfigured: boolean;
  googleUrl: string | null;
  slackUrl: string | null;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  service: string;
  dependencies: {
    postgres: string;
    redis: string;
    elasticsearch: string;
  };
}
