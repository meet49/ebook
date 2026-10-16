import { env } from '../../config/env';
import { decryptField } from '../crypto';
import { logger } from '../logger';
import { SETTING_KEYS, Setting } from '../../models/Setting';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  /** Saved from Admin → Settings, or taken from environment variables. */
  source: 'database' | 'environment';
}

export interface StoredRazorpaySettings {
  keyId: string;
  keySecretEnc: string;
  webhookSecretEnc?: string | null;
}

const CACHE_MS = 30_000;
let cache: { value: RazorpayCredentials | null; at: number } | null = null;

/** Call after the settings change so the next request uses the new keys immediately. */
export function invalidatePaymentConfig(): void {
  cache = null;
}

/**
 * Effective Razorpay credentials. Keys saved by an admin in Settings take precedence over
 * environment variables, so keys can be rotated without a redeploy.
 */
export async function getRazorpayCredentials(): Promise<RazorpayCredentials | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let value: RazorpayCredentials | null = null;
  const stored = (await Setting.findOne({ key: SETTING_KEYS.razorpay }).lean())?.value as StoredRazorpaySettings | undefined;
  if (stored?.keyId && stored.keySecretEnc) {
    try {
      value = {
        keyId: stored.keyId,
        keySecret: decryptField(stored.keySecretEnc),
        webhookSecret: stored.webhookSecretEnc ? decryptField(stored.webhookSecretEnc) : null,
        source: 'database',
      };
    } catch (err) {
      // Happens if APP_SECRET changed after the keys were saved. Fall back to the environment.
      logger.error({ err }, 'Saved Razorpay settings cannot be decrypted; re-enter them in Admin → Settings');
    }
  }
  if (!value && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    value = {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? null,
      source: 'environment',
    };
  }
  cache = { value, at: Date.now() };
  return value;
}

export function modeOf(keyId: string | null | undefined): 'test' | 'live' | 'unconfigured' {
  if (!keyId) return 'unconfigured';
  return keyId.startsWith('rzp_live_') ? 'live' : 'test';
}

export type CredentialCheck = { ok: true } | { ok: false; reason: 'rejected' | 'unreachable'; message: string };

/** Asks Razorpay whether a key pair is valid (a harmless read of at most one order). */
async function razorpayCredentialCheck(keyId: string, keySecret: string): Promise<CredentialCheck> {
  try {
    const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, reason: 'rejected', message: 'Razorpay rejected this Key ID and Key Secret.' };
    return { ok: false, reason: 'unreachable', message: `Razorpay returned HTTP ${res.status}. Please try again.` };
  } catch {
    return { ok: false, reason: 'unreachable', message: 'Could not reach Razorpay. Check the server’s internet connection.' };
  }
}

let checker: (keyId: string, keySecret: string) => Promise<CredentialCheck> = razorpayCredentialCheck;

export function verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<CredentialCheck> {
  return checker(keyId, keySecret);
}

/** Test hook only. */
export function setCredentialChecker(fn: typeof checker | null): void {
  checker = fn ?? razorpayCredentialCheck;
}
