import nodemailer from 'nodemailer';
import { getTransporter, resetTransporter } from '../config/mail';
import { ENV } from '../config/env';
import { stripHtml } from '../utils/sanitize';

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail({
  from,
  to,
  subject,
  text,
  html,
}: SendMailOptions): Promise<SendMailResult> {
  const payload = {
    from: from || ENV.EMAIL_FROM,
    to,
    subject,
    text: text || (html ? stripHtml(html) : undefined),
    html: html || text,
  };

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(payload);
    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  } catch (err) {
    // Retry once with a fresh transporter if Ethereal/SMTP connection expired
    resetTransporter();
    const transporter = await getTransporter();
    const info = await transporter.sendMail(payload);
    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }
}
