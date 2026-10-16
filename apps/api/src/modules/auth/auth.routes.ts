import { Router } from 'express';
import { z } from 'zod';
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
} from '@ebook/shared';
import { audit } from '../../lib/audit';
import { hashPassword, verifyPassword } from '../../lib/crypto';
import { HttpError, badRequest } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { emailSendLimiter, loginLimiter, sensitiveLimiter } from '../../middleware/rateLimit';
import { parse } from '../../middleware/validate';
import { User, toPublicUser } from '../../models/User';
import {
  authenticate,
  registerCustomer,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './auth.service';
import { rememberReferral } from '../affiliates/attribution';
import { endSession, revokeAllSessions, startSession } from './session';
import { consumeAuthToken, safeRedirectPath } from './tokens';

export const authRouter = Router();

const invalidLink = () =>
  new HttpError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Please request a new one.');

/** Generic response for endpoints that must not reveal whether an email is registered. */
const ACCEPTED = { ok: true, message: 'If an account exists for that email, we have sent a message to it.' };

authRouter.post('/register', sensitiveLimiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  const user = await registerCustomer(input);
  await startSession(req, res, user._id);
  await rememberReferral(req, user._id);
  await sendVerificationEmail(user);
  await audit({ action: 'auth.register', actorId: user._id, entityType: 'User', entityId: user._id, req });
  res.status(201).json({ user: toPublicUser(user, true) });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password, portal } = parse(loginSchema, req.body);
  try {
    const user = await authenticate(email, password, portal);
    await startSession(req, res, user._id);
    await rememberReferral(req, user._id);
    await audit({ action: 'auth.login', actorId: user._id, meta: { portal }, req });
    res.json({ user: toPublicUser(user, true) });
  } catch (err) {
    await audit({ action: 'auth.login_failed', meta: { email, portal, reason: (err as HttpError).code }, req });
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  if (req.auth) await audit({ action: 'auth.logout', req });
  await endSession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const { user, hasPassword } = req.auth!;
  res.json({ user: toPublicUser(user, hasPassword) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const { name } = parse(updateProfileSchema, req.body);
  const { user, hasPassword } = req.auth!;
  user.name = name;
  await user.save();
  res.json({ user: toPublicUser(user, hasPassword) });
});

authRouter.post('/change-password', requireAuth, sensitiveLimiter, async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  const { user, session, hasPassword } = req.auth!;

  if (hasPassword) {
    const withHash = await User.findById(user._id).select('+passwordHash');
    if (!currentPassword || !(await verifyPassword(currentPassword, withHash?.passwordHash))) {
      throw badRequest('Current password is incorrect', { currentPassword: ['Current password is incorrect'] });
    }
  }

  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(user._id, session._id);
  await audit({ action: hasPassword ? 'auth.password_changed' : 'auth.password_set', req });
  res.json({ user: toPublicUser(user, true) });
});

authRouter.post('/resend-verification', requireAuth, emailSendLimiter, async (req, res) => {
  const { user } = req.auth!;
  if (!user.emailVerifiedAt) await sendVerificationEmail(user);
  res.json({ ok: true });
});

authRouter.post('/verify-email', sensitiveLimiter, async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  const record = await consumeAuthToken(token, 'verify_email');
  if (!record) throw invalidLink();
  await User.updateOne({ _id: record.userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  await audit({ action: 'auth.email_verified', actorId: record.userId, req });
  res.json({ ok: true });
});

authRouter.post('/forgot-password', emailSendLimiter, async (req, res) => {
  const { email } = parse(emailOnlySchema, req.body);
  const user = await User.findOne({ email, status: 'active' });
  if (user) await sendPasswordResetEmail(user);
  res.status(202).json(ACCEPTED);
});

authRouter.post('/reset-password', sensitiveLimiter, async (req, res) => {
  const { token, password } = parse(resetPasswordSchema, req.body);
  const record = await consumeAuthToken(token, 'reset_password');
  if (!record) throw invalidLink();

  const user = await User.findOne({ _id: record.userId, status: 'active' });
  if (!user) throw invalidLink();

  // Receiving the reset email proves ownership of the address.
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(password), emailVerifiedAt: user.emailVerifiedAt ?? new Date() } },
  );
  await revokeAllSessions(user._id);
  await audit({ action: 'auth.password_reset', actorId: user._id, req });
  res.json({ ok: true });
});

const magicLinkRequestSchema = emailOnlySchema.extend({ redirectTo: z.string().max(300).optional() });

authRouter.post('/magic-link', emailSendLimiter, async (req, res) => {
  const { email, redirectTo } = parse(magicLinkRequestSchema, req.body);
  const user = await User.findOne({ email, status: 'active' });
  if (user) await sendMagicLinkEmail(user, safeRedirectPath(redirectTo));
  res.status(202).json(ACCEPTED);
});

authRouter.post('/magic-login', sensitiveLimiter, async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  const record = await consumeAuthToken(token, 'magic_login');
  if (!record) throw invalidLink();

  const user = await User.findOne({ _id: record.userId, status: 'active' }).select('+passwordHash');
  if (!user) throw invalidLink();

  user.emailVerifiedAt ??= new Date();
  user.lastLoginAt = new Date();
  await user.save();
  await startSession(req, res, user._id);
  await rememberReferral(req, user._id);
  await audit({ action: 'auth.magic_login', actorId: user._id, req });
  res.json({ user: toPublicUser(user, Boolean(user.passwordHash)), redirectTo: record.redirectTo ?? null });
});
