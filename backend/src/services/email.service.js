const nodemailer = require('nodemailer');
const { getTransporter, resetTransporter } = require('../config/mail');
const { ENV } = require('../config/env');
const { stripHtml } = require('../utils/sanitize');

async function sendEmail({ from, to, subject, text, html }) {
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
    return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
  } catch {
    // Retry once with fresh transporter if Ethereal/SMTP connection expired
    resetTransporter();
    const transporter = await getTransporter();
    const info = await transporter.sendMail(payload);
    return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
  }
}

module.exports = { sendEmail };
