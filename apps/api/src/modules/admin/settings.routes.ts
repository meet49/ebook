import { Router, type Request } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { decryptField, encryptField, verifyPassword } from '../../lib/crypto';
import { HttpError, badRequest } from '../../lib/errors';
import {
  getRazorpayCredentials,
  invalidatePaymentConfig,
  modeOf,
  verifyRazorpayCredentials,
  type StoredRazorpaySettings,
} from '../../lib/payments/config';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { parse } from '../../middleware/validate';
import { SETTING_KEYS, Setting } from '../../models/Setting';
import { User } from '../../models/User';

export const adminSettingsRouter = Router();

const last4 = (value: string) => (value.length > 4 ? value.slice(-4) : '••••');

/**
 * Changing where payments go is high-risk, so every write re-checks the admin's password
 * (step-up authentication) on top of the admin session.
 */
async function confirmPassword(req: Request, password: string | undefined): Promise<void> {
  const user = await User.findById(req.auth!.user._id).select('+passwordHash');
  if (!password || !(await verifyPassword(password, user?.passwordHash))) {
    throw badRequest('Your password is incorrect', { currentPassword: ['Your password is incorrect'] });
  }
}

async function paymentSettingsDto() {
  const [creds, stored] = await Promise.all([getRazorpayCredentials(), Setting.findOne({ key: SETTING_KEYS.razorpay })]);
  const updatedBy = stored?.updatedBy ? await User.findById(stored.updatedBy).select('email') : null;
  return {
    mode: modeOf(creds?.keyId),
    source: creds?.source ?? 'none',
    keyId: creds?.keyId ?? null,
    keySecretLast4: creds ? last4(creds.keySecret) : null,
    webhookSecretSet: Boolean(creds?.webhookSecret),
    webhookUrl: `${env.APP_URL}/api/v1/webhooks/razorpay`,
    webhookEvents: ['payment.captured', 'order.paid', 'payment.failed', 'refund.created', 'refund.processed', 'refund.failed'],
    environmentConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    savedInDashboard: Boolean(stored),
    updatedAt: stored?.updatedAt?.toISOString() ?? null,
    updatedBy: updatedBy?.email ?? null,
  };
}

adminSettingsRouter.get('/payments', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ payments: await paymentSettingsDto() });
});

const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;

const saveBody = z.object({
  keyId: z.string().trim().regex(KEY_ID, 'Key ID looks like rzp_test_… or rzp_live_…'),
  /** Leave empty to keep the saved secret (only allowed when the Key ID is unchanged). */
  keySecret: z.string().trim().max(200).default(''),
  /** Leave empty to keep the saved webhook secret; send `clearWebhookSecret` to remove it. */
  webhookSecret: z.string().trim().max(200).default(''),
  clearWebhookSecret: z.boolean().default(false),
  currentPassword: z.string().max(128).optional(),
});

adminSettingsRouter.put('/payments', sensitiveLimiter, async (req, res) => {
  const input = parse(saveBody, req.body);
  await confirmPassword(req, input.currentPassword);

  const existing = (await Setting.findOne({ key: SETTING_KEYS.razorpay }))?.value as StoredRazorpaySettings | undefined;
  let keySecret = input.keySecret;
  if (!keySecret) {
    if (!existing || existing.keyId !== input.keyId) {
      throw badRequest('Enter the Key Secret for this Key ID', { keySecret: ['Enter the Key Secret for this Key ID'] });
    }
    keySecret = decryptField(existing.keySecretEnc);
  }

  // Never save keys Razorpay does not accept: a typo would silently break every checkout.
  const check = await verifyRazorpayCredentials(input.keyId, keySecret);
  if (!check.ok) {
    throw new HttpError(check.reason === 'rejected' ? 400 : 502, 'INVALID_CREDENTIALS', check.message, {
      keySecret: [check.message],
    });
  }

  const webhookSecretEnc = input.clearWebhookSecret
    ? null
    : input.webhookSecret
      ? encryptField(input.webhookSecret)
      : (existing?.webhookSecretEnc ?? null);
  const value: StoredRazorpaySettings = { keyId: input.keyId, keySecretEnc: encryptField(keySecret), webhookSecretEnc };

  await Setting.updateOne(
    { key: SETTING_KEYS.razorpay },
    { $set: { value, updatedBy: req.auth!.user._id } },
    { upsert: true },
  );
  invalidatePaymentConfig();
  await audit({
    action: 'settings.payments_updated',
    entityType: 'Setting',
    meta: {
      keyId: input.keyId,
      mode: modeOf(input.keyId),
      keyIdChanged: existing?.keyId !== input.keyId,
      keySecretChanged: Boolean(input.keySecret),
      webhookSecretChanged: Boolean(input.webhookSecret) || input.clearWebhookSecret,
    },
    req,
  });
  res.json({ payments: await paymentSettingsDto() });
});

/** Checks the currently effective keys against Razorpay without changing anything. */
adminSettingsRouter.post('/payments/test', sensitiveLimiter, async (_req, res) => {
  const creds = await getRazorpayCredentials();
  if (!creds) throw new HttpError(409, 'PAYMENTS_NOT_CONFIGURED', 'No Razorpay keys are configured yet');
  const check = await verifyRazorpayCredentials(creds.keyId, creds.keySecret);
  res.json({ ok: check.ok, message: check.ok ? `Connected to Razorpay (${modeOf(creds.keyId)} mode)` : check.message });
});

const removeBody = z.object({ currentPassword: z.string().max(128).optional() });

/** Removes keys saved in the dashboard; environment variables (if any) take effect again. */
adminSettingsRouter.delete('/payments', sensitiveLimiter, async (req, res) => {
  const { currentPassword } = parse(removeBody, req.body ?? {});
  await confirmPassword(req, currentPassword);
  await Setting.deleteOne({ key: SETTING_KEYS.razorpay });
  invalidatePaymentConfig();
  await audit({ action: 'settings.payments_removed', entityType: 'Setting', req });
  res.json({ payments: await paymentSettingsDto() });
});
