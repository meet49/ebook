import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const BCRYPT_COST = 12;

/** URL-safe random token with 256 bits of entropy. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes so a DB leak does not leak live sessions or links. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** One-way, keyed IP hash for analytics without storing raw IPs. */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return hmacSha256Hex(env.APP_SECRET, `ip:${ip}`).slice(0, 32);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// Compared against when the user does not exist so login timing does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

export async function verifyPassword(password: string, hash: string | undefined | null): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && Boolean(hash);
}

const SECRET_KEY = createHash('sha256').update(`${env.APP_SECRET}:field-encryption:v1`).digest();

/** Encrypts small sensitive fields (e.g. bank account numbers) at rest with AES-256-GCM. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')}`;
}

export function decryptField(value: string): string {
  const raw = Buffer.from(value.replace(/^v1\./, ''), 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', SECRET_KEY, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Signs a short value for a tamper-proof cookie: "<value>.<mac>". */
export function signValue(value: string): string {
  return `${value}.${hmacSha256Hex(env.APP_SECRET, `cookie:${value}`).slice(0, 32)}`;
}

export function unsignValue(signed: unknown): string | null {
  if (typeof signed !== 'string' || signed.length > 200) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  return safeEqual(signValue(value), signed) ? value : null;
}
