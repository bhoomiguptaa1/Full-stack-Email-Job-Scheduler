require('dotenv').config();

const DEFAULT_JWT_SECRET = 'reachinbox_super_secret_jwt_key_2026';

const ENV = {
  PORT:                    parseInt(process.env.PORT || '5000', 10),
  NODE_ENV:                process.env.NODE_ENV || 'development',
  FRONTEND_URL:            process.env.FRONTEND_URL || 'http://localhost:5173',
  MONGODB_URI:             process.env.MONGODB_URI || 'mongodb://localhost:27017/reachinbox_db',
  REDIS_URL:               process.env.REDIS_URL || '',
  REDIS_HOST:              process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT:              parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD:          process.env.REDIS_PASSWORD || undefined,
  JWT_SECRET:              process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  SMTP_HOST:               process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT:               parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER:               process.env.SMTP_USER || '',
  SMTP_PASS:               process.env.SMTP_PASS || '',
  EMAIL_FROM:              process.env.EMAIL_FROM || 'ReachInbox Scheduler <scheduler@reachinbox.test>',
  WORKER_CONCURRENCY:      Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '5', 10)),
  DEFAULT_SENDER_HOURLY_LIMIT: Math.max(1, parseInt(process.env.DEFAULT_SENDER_HOURLY_LIMIT || '50', 10)),
  AUTH_RATE_LIMIT_MAX:     Math.max(5, parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10)),
  API_RATE_LIMIT_MAX:      Math.max(20, parseInt(process.env.API_RATE_LIMIT_MAX || '200', 10)),
};

if (ENV.NODE_ENV === 'production' && ENV.JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a secure random value in production.');
}

module.exports = { ENV };
