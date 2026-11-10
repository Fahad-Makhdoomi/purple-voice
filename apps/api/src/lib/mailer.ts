import { env } from '../config/env';
import { createTransport, currentMailServer } from '../services/email-settings';
import { logger } from './logger';

export interface Mail {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Sends mail through the mail server a super admin set up (Super admin →
 * Email), or the SMTP_* environment variables. With neither, it logs the mail
 * so password resets and notifications are still usable in local development.
 * Failures are logged, never thrown: a mail problem must not break sign-up.
 */
export async function sendMail(mail: Mail): Promise<void> {
  try {
    await sendMailStrict(mail);
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send mail');
  }
}

/**
 * The platform's email comes from hello@purplerocket.co. A sender still on the
 * old placeholder domain (purplevoice.ai, which we don't send from) is replaced.
 */
export function senderAddress(from: string): string {
  return /@purplevoice\.ai\b/i.test(from) ? 'Purple Voice <hello@purplerocket.co>' : from;
}

/** Like sendMail, but says what went wrong; used by the "send a test email" button. */
export async function sendMailStrict(mail: Mail): Promise<{ sent: boolean }> {
  const server = await currentMailServer();
  if (!server) {
    // The body can hold a one-time link (password reset); print it only in development.
    if (env.isProd) logger.error({ to: mail.to, subject: mail.subject }, 'No mail server set up; email not sent');
    else logger.info({ to: mail.to, subject: mail.subject }, `[mail:dev] ${mail.text}`);
    return { sent: false };
  }
  const transport = createTransport(server);
  try {
    await transport.sendMail({
      from: senderAddress(server.from),
      replyTo: env.MAIL_REPLY_TO,
      ...mail,
    });
  } finally {
    transport.close();
  }
  return { sent: true };
}
