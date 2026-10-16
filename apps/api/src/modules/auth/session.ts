import type { CookieOptions, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { env, isProd } from '../../config/env';
import { generateToken, hashToken } from '../../lib/crypto';
import { Session } from '../../models/Session';

/** Sessions are extended at most this often (sliding expiry). */
export const SESSION_REFRESH_MS = 60 * 60_000;

export const sessionTtlMs = () => env.SESSION_TTL_DAYS * 24 * 60 * 60_000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  };
}

/** Creates a new session and sets the cookie. Any session presented by this request is revoked first (rotation). */
export async function startSession(req: Request, res: Response, userId: Types.ObjectId): Promise<void> {
  if (req.auth?.session) await req.auth.session.deleteOne();

  const token = generateToken();
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + sessionTtlMs()),
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  });
  res.cookie(env.SESSION_COOKIE_NAME, token, { ...cookieOptions(), maxAge: sessionTtlMs() });
}

export async function endSession(req: Request, res: Response): Promise<void> {
  if (req.auth?.session) await req.auth.session.deleteOne();
  clearSessionCookie(res);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions());
}

/** Signs the user out everywhere, optionally keeping one session (e.g. the current device). */
export async function revokeAllSessions(userId: Types.ObjectId, exceptSessionId?: Types.ObjectId): Promise<void> {
  await Session.deleteMany({ userId, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) });
}
