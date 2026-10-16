import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * In-memory limiters suit a single API instance. For horizontal scaling, plug a shared
 * store (e.g. rate-limit-redis) into each limiter — see docs/DEPLOYMENT.md.
 */
const base = {
  // Test suites send every request from one IP; they opt out here and test limits explicitly.
  skip: () => process.env.DISABLE_RATE_LIMITS === '1',
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
};

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

const emailKey = (req: Request) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${ipKey(req)}|${email}`;
};

/** Brute-force protection for password login: per IP + email. */
export const loginLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, keyGenerator: emailKey });

/** Endpoints that send email: per IP + email, to stop inbox flooding. */
export const emailSendLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 5, keyGenerator: emailKey });

/** Account creation and token redemption: per IP. */
export const sensitiveLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 30, keyGenerator: ipKey });

/** Generous global ceiling for the whole API. */
export const globalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, keyGenerator: ipKey });
