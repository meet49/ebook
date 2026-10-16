import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Emails captured by the console transport (development/test only).
 * Lets tests read links out of emails without a real mail server.
 */
export const devOutbox: EmailMessage[] = [];

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.EMAIL_TRANSPORT === 'console') {
    devOutbox.push(message);
    if (devOutbox.length > 100) devOutbox.shift();
    logger.info(
      { to: message.to, subject: message.subject },
      `[DEV EMAIL — not actually sent]\n${message.text}`,
    );
    return;
  }

  await getTransporter().sendMail({ from: env.EMAIL_FROM, ...message });
  logger.info({ to: message.to, subject: message.subject }, 'Email sent');
}

/** Fire-and-forget for non-critical mail; failures are logged, never thrown to the request. */
export function sendEmailInBackground(message: EmailMessage): void {
  sendEmail(message).catch((err) => logger.error({ err, subject: message.subject }, 'Email delivery failed'));
}
