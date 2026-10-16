import { PORTALS, type Portal, type RegisterInput, type Role } from '@ebook/shared';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../lib/crypto';
import { sendEmailInBackground } from '../../lib/email/transport';
import { magicLinkTemplate, resetPasswordTemplate, verifyEmailTemplate } from '../../lib/email/templates';
import { HttpError, conflict, forbidden } from '../../lib/errors';
import { User, type UserDoc } from '../../models/User';
import { issueAuthToken } from './tokens';

const PORTAL_ROLE: Record<Portal, Role> = {
  customer: 'customer',
  affiliate: 'affiliate',
  admin: 'admin',
};

const PORTAL_LABEL: Record<Portal, string> = {
  customer: 'reader',
  affiliate: 'affiliate',
  admin: 'admin',
};

const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

export async function registerCustomer(input: RegisterInput): Promise<UserDoc> {
  const existing = await User.exists({ email: input.email });
  if (existing) {
    throw conflict('An account with this email already exists. Sign in or reset your password.');
  }
  return User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    roles: ['customer'],
  });
}

/**
 * Password login bound to a portal. Credentials are checked before the role so a wrong
 * password never reveals which portals an account can use.
 */
export async function authenticate(email: string, password: string, portal: Portal): Promise<UserDoc> {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) throw invalidCredentials();
  if (user.status !== 'active') throw forbidden('This account has been suspended. Please contact support.');
  if (!user.roles.includes(PORTAL_ROLE[portal])) {
    // Safe to reveal the account's portals here: the password has already been verified.
    const allowed = PORTALS.filter((p) => user.roles.includes(PORTAL_ROLE[p]));
    throw new HttpError(
      403,
      'WRONG_PORTAL',
      `This account does not have ${PORTAL_LABEL[portal]} access. Please use the correct sign-in page.`,
      { portals: allowed },
    );
  }
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function sendVerificationEmail(user: UserDoc): Promise<void> {
  const token = await issueAuthToken(user._id, 'verify_email');
  const url = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  sendEmailInBackground(verifyEmailTemplate(user.email, user.name, url));
}

export async function sendPasswordResetEmail(user: UserDoc): Promise<void> {
  const token = await issueAuthToken(user._id, 'reset_password');
  const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  sendEmailInBackground(resetPasswordTemplate(user.email, user.name, url));
}

/** Magic links land on a page that requires a click to POST, so email scanners prefetching GETs cannot consume them. */
export async function sendMagicLinkEmail(user: UserDoc, redirectTo?: string): Promise<void> {
  const token = await issueAuthToken(user._id, 'magic_login', redirectTo);
  const url = `${env.APP_URL}/auth/magic?token=${encodeURIComponent(token)}`;
  sendEmailInBackground(magicLinkTemplate(user.email, user.name, url));
}
