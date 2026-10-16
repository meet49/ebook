import type { EmailMessage } from './transport';

const BRAND = 'ReadnShare';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LayoutInput {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

function render({ heading, paragraphs, cta, footnote }: LayoutInput): { html: string; text: string } {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#6b7280">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(cta.url)}</span></p>`
    : '';
  const foot = footnote ? `<p style="margin:24px 0 0;font-size:13px;color:#6b7280">${escapeHtml(footnote)}</p>` : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
  <p style="margin:0 0 24px;font-weight:700;color:#4f46e5">${BRAND}</p>
  <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(heading)}</h1>
  ${body}${button}${foot}
  </td></tr></table></td></tr></table></body></html>`;

  const text = [heading, '', ...paragraphs, ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), ...(footnote ? ['', footnote] : [])].join('\n');
  return { html, text };
}

export function verifyEmailTemplate(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: `Verify your email for ${BRAND}`,
    ...render({
      heading: `Welcome, ${name}`,
      paragraphs: ['Please confirm your email address to secure your account.'],
      cta: { label: 'Verify email', url },
      footnote: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    }),
  };
}

export function resetPasswordTemplate(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: `Reset your ${BRAND} password`,
    ...render({
      heading: 'Reset your password',
      paragraphs: [`Hi ${name}, we received a request to reset your password.`],
      cta: { label: 'Choose a new password', url },
      footnote: 'This link expires in 1 hour and can be used once. If you did not request it, no action is needed.',
    }),
  };
}

export function purchaseTemplate(
  to: string,
  input: { name: string; title: string; orderNumber: string; amount: string; url: string; newAccount: boolean },
): EmailMessage {
  return {
    to,
    subject: `Your eBook is ready: ${input.title}`,
    ...render({
      heading: 'Thank you for your purchase!',
      paragraphs: [
        `Hi ${input.name}, your payment was verified and "${input.title}" is now in your library.`,
        `Order ${input.orderNumber} · ${input.amount}`,
        input.newAccount
          ? 'We created a library account for you with this email address. Use the button below to sign in — you can set a password afterwards from Account settings.'
          : 'Use the button below to open your library, or sign in with your password as usual.',
      ],
      cta: { label: 'Open my library', url: input.url },
      footnote:
        'This sign-in link works once and expires in 72 hours. After that, use "Email me a sign-in link" on the sign-in page. Your eBook is read online — it is not attached to this email.',
    }),
  };
}

export function affiliateDecisionTemplate(
  to: string,
  input: { name: string; approved: boolean; note?: string | null; url: string },
): EmailMessage {
  return {
    to,
    subject: input.approved ? `You're in! Your ${BRAND} affiliate account is approved` : `Your ${BRAND} affiliate application`,
    ...render({
      heading: input.approved ? 'Welcome to the affiliate program' : 'About your application',
      paragraphs: input.approved
        ? [
            `Hi ${input.name}, your affiliate application has been approved.`,
            'Sign in to your affiliate dashboard to generate referral links for each eBook and track your clicks, sales and commissions.',
          ]
        : [`Hi ${input.name}, thank you for applying. We are unable to approve your application at this time.`, ...(input.note ? [`Note from our team: ${input.note}`] : [])],
      cta: input.approved ? { label: 'Open affiliate dashboard', url: input.url } : undefined,
    }),
  };
}

export function payoutPaidTemplate(to: string, input: { name: string; amount: string; reference: string; url: string }): EmailMessage {
  return {
    to,
    subject: `Payout sent: ${input.amount}`,
    ...render({
      heading: 'Your payout has been sent',
      paragraphs: [`Hi ${input.name}, we have sent ${input.amount} to your registered payout account.`, `Payment reference: ${input.reference}`],
      cta: { label: 'View payout history', url: input.url },
    }),
  };
}

export function magicLinkTemplate(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: `Your ${BRAND} sign-in link`,
    ...render({
      heading: 'Sign in to your library',
      paragraphs: [`Hi ${name}, use the button below to sign in.`],
      cta: { label: 'Sign in', url },
      footnote: 'This link expires in 30 minutes and can be used once. Never share it with anyone.',
    }),
  };
}
