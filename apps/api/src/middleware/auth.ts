import type { RequestHandler } from 'express';
import type { Role } from '@ebook/shared';
import { env } from '../config/env';
import { hashToken } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { clearSessionCookie, SESSION_REFRESH_MS, sessionTtlMs } from '../modules/auth/session';

/**
 * Resolves the session cookie (if any) into req.auth. Never rejects on its own;
 * use requireAuth / requireRole to enforce access.
 */
export const loadSession: RequestHandler = async (req, res, next) => {
  const raw: unknown = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) return next();

  const session = await Session.findOne({ tokenHash: hashToken(raw), expiresAt: { $gt: new Date() } });
  if (!session) {
    clearSessionCookie(res);
    return next();
  }

  const user = await User.findById(session.userId).select('+passwordHash');
  if (!user || user.status !== 'active') {
    await session.deleteOne();
    clearSessionCookie(res);
    return next();
  }

  // Sliding expiry, written at most once per refresh interval to limit DB writes.
  const now = Date.now();
  if (now - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    session.lastSeenAt = new Date(now);
    session.expiresAt = new Date(now + sessionTtlMs());
    await session.save();
  }

  const hasPassword = Boolean(user.passwordHash);
  user.passwordHash = undefined;
  req.auth = { user, session, hasPassword };
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  next();
};

/** Requires an authenticated user holding at least one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!req.auth.user.roles.some((r) => roles.includes(r))) return next(forbidden());
    next();
  };
}
