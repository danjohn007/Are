import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: false,
  auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
});

export async function sendLeadNotification({ serviceName, leadName, leadEmail }) {
  if (!env.smtpHost) {
    logger.info('SMTP not configured, skipping lead notification email');
    return;
  }

  const html = `
    <h2>New Lead Received</h2>
    <p><strong>Name:</strong> ${leadName}</p>
    <p><strong>Email:</strong> ${leadEmail}</p>
    <p><strong>Service:</strong> ${serviceName || 'N/A'}</p>
  `;

  await transporter.sendMail({
    from: env.mailFrom,
    to: env.mailFrom,
    subject: 'New Lead Notification',
    html
  });
}
