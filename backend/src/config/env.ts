import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_JWT_SECRET = 'reachinbox_super_secret_jwt_key_2026';

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://reachinbox_user:reachinbox_password@localhost:5432/reachinbox_db?schema=public',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  ELASTICSEARCH_NODE: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX || 'reachinbox_emails',
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
  SLACK_REDIRECT_URI:
    process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/auth/slack/callback',
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'ReachInbox Scheduler <scheduler@reachinbox.test>',
  WORKER_CONCURRENCY: Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '5', 10)),
  DEFAULT_SENDER_HOURLY_LIMIT: Math.max(
    1,
    parseInt(process.env.DEFAULT_SENDER_HOURLY_LIMIT || '50', 10)
  ),
  AUTH_RATE_LIMIT_MAX: Math.max(5, parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10)),
  API_RATE_LIMIT_MAX: Math.max(20, parseInt(process.env.API_RATE_LIMIT_MAX || '200', 10)),
};

if (ENV.NODE_ENV === 'production' && ENV.JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a secure random value in production.');
}
