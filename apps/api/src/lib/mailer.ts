import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

export interface Mail {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends mail when SMTP is configured; otherwise logs it, so password resets
 * and notifications are still usable in local development.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!transport) {
    logger.info({ to: mail.to, subject: mail.subject }, `[mail:dev] ${mail.text}`);
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send mail');
  }
}
