import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    APP_URL: z.url().default('http://localhost:3000'),
    ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),

    MONGODB_URI: z.string().min(1),
    /** Optional DNS servers for Node (e.g. "8.8.8.8,1.1.1.1") when the system resolver refuses SRV lookups. */
    DNS_SERVERS: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),

    SESSION_COOKIE_NAME: z.string().default('ebook_sid'),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    /** smtp: any SMTP provider. brevo: Brevo's HTTPS API (works where SMTP ports are blocked, e.g. Render free). */
    EMAIL_TRANSPORT: z.enum(['smtp', 'brevo', 'console']).default('console'),
    BREVO_API_KEY: optionalString,
    EMAIL_FROM: z.string().default('ReadnShare <no-reply@example.com>'),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,

    /** "local" keeps files in a private folder on disk (development); "s3" for S3-compatible storage. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_DIR: z.string().default('./storage'),
    MAX_PDF_MB: z.coerce.number().int().min(1).max(1024).default(200),
    MAX_COVER_MB: z.coerce.number().int().min(1).max(50).default(5),
    /** Rendered page width in pixels. 1400 keeps text crisp on phones and laptops. */
    PAGE_RENDER_WIDTH: z.coerce.number().int().min(600).max(3000).default(1400),

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_FORCE_PATH_STYLE: bool,

    RAZORPAY_KEY_ID: optionalString,
    RAZORPAY_KEY_SECRET: optionalString,
    RAZORPAY_WEBHOOK_SECRET: optionalString,

    ATTRIBUTION_WINDOW_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COMMISSION_HOLD_DAYS: z.coerce.number().int().min(0).max(90).default(7),
    MIN_PAYOUT_PAISE: z.coerce.number().int().min(0).default(50_000),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Use private S3-compatible storage in production' });
    }
    if (env.EMAIL_TRANSPORT === 'console') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_TRANSPORT'], message: 'console transport is not allowed in production' });
    }
    if (env.EMAIL_TRANSPORT === 'brevo' && !env.BREVO_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'BREVO_API_KEY is required when EMAIL_TRANSPORT=brevo' });
    }
    if (env.EMAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required' });
    }
    if (!env.APP_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'APP_URL must be https in production' });
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Origins allowed to send state-changing, credentialed requests. */
export const allowedOrigins = new Set([new URL(env.APP_URL).origin, ...env.ALLOWED_ORIGINS]);
