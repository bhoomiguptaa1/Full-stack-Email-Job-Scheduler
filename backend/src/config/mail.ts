import nodemailer from 'nodemailer';
import { ENV } from './env';
import { logger } from '../utils/logger';

let cachedTransporter: nodemailer.Transporter | null = null;
let transporterPromise: Promise<nodemailer.Transporter> | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (ENV.SMTP_USER && ENV.SMTP_PASS) {
      cachedTransporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_PORT === 465,
        auth: {
          user: ENV.SMTP_USER,
          pass: ENV.SMTP_PASS,
        },
      });
      return cachedTransporter;
    }

    logger.info('[Nodemailer] Creating automatic Ethereal test mailbox...');
    const testAccount = await nodemailer.createTestAccount();

    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    logger.info('[Nodemailer] Ethereal test account ready', { user: testAccount.user });
    return cachedTransporter;
  })();

  try {
    return await transporterPromise;
  } finally {
    transporterPromise = null;
  }
}

export function resetTransporter(): void {
  cachedTransporter = null;
}
