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

  if (env.EMAIL_TRANSPORT === 'brevo') {
    await sendViaBrevo(message);
  } else {
    await getTransporter().sendMail({ from: env.EMAIL_FROM, ...message });
  }
  logger.info({ to: message.to, subject: message.subject }, 'Email sent');
}

/** "ReadnShare <no-reply@readnshare.in>" → { name, email } */
export function parseFrom(from: string): { name?: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) return { name: match[1]?.trim() || undefined, email: match[2]!.trim() };
  return { email: from.trim() };
}

/**
 * Brevo transactional email over HTTPS (port 443). Used where outbound SMTP ports are
 * blocked, such as Render's free plan. https://developers.brevo.com/reference/sendtransacemail
 */
async function sendViaBrevo(message: EmailMessage): Promise<void> {
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseFrom(env.EMAIL_FROM),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Fire-and-forget for non-critical mail; failures are logged, never thrown to the request. */
export function sendEmailInBackground(message: EmailMessage): void {
  sendEmail(message).catch((err) => logger.error({ err, subject: message.subject }, 'Email delivery failed'));
}
