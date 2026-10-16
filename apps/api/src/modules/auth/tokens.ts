import type { Types } from 'mongoose';
import type { AuthTokenPurpose } from '@ebook/shared';
import { generateToken, hashToken } from '../../lib/crypto';
import { AuthToken } from '../../models/AuthToken';

const TTL_MS: Record<AuthTokenPurpose, number> = {
  verify_email: 24 * 60 * 60_000,
  reset_password: 60 * 60_000,
  magic_login: 30 * 60_000,
};

/** Only same-site relative paths are accepted as post-login redirects. */
export function safeRedirectPath(path: unknown): string | undefined {
  if (typeof path !== 'string' || path.length > 300) return undefined;
  // Browsers strip tabs/newlines and treat "\" like "/", so "/\t/evil.com" would become "//evil.com".
  // eslint-disable-next-line no-control-regex
  if (!path.startsWith('/') || /[\u0000- \\]/.test(path) || /^\/(\/|%2f|%5c)/i.test(path)) return undefined;
  try {
    const base = 'https://app.invalid';
    const url = new URL(path, base);
    if (url.origin !== base) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

/** Issues a single-use token. Earlier unused tokens of the same purpose are invalidated. */
export async function issueAuthToken(
  userId: Types.ObjectId,
  purpose: AuthTokenPurpose,
  redirectTo?: string,
  ttlMs: number = TTL_MS[purpose],
): Promise<string> {
  const now = new Date();
  await AuthToken.updateMany({ userId, purpose, usedAt: null }, { $set: { usedAt: now } });

  const token = generateToken();
  await AuthToken.create({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
    redirectTo: safeRedirectPath(redirectTo),
  });
  return token;
}

/** Atomically marks a valid token as used. Returns null if it is unknown, expired or already used. */
export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose) {
  const now = new Date();
  return AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(token), purpose, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: 'after' },
  );
}
