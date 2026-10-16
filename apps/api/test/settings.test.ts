import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getRazorpayCredentials, setCredentialChecker } from '../src/lib/payments/config';
import { AuditLog } from '../src/models/AuditLog';
import { Setting } from '../src/models/Setting';
import { agent, app, createUser } from './helpers';

const PASSWORD = 'admin-pass-1';
let admin: ReturnType<typeof agent>;
let n = 0;

beforeEach(async () => {
  const email = `settings-admin${++n}@example.com`;
  await createUser({ email, password: PASSWORD, roles: ['admin'] });
  admin = agent();
  await admin.post('/api/v1/auth/login').send({ email, password: PASSWORD, portal: 'admin' }).expect(200);
  // Pretend Razorpay accepts keys whose secret starts with "good".
  setCredentialChecker(async (_id, secret) =>
    secret.startsWith('good') ? { ok: true } : { ok: false, reason: 'rejected', message: 'Razorpay rejected this Key ID and Key Secret.' },
  );
});

afterEach(() => setCredentialChecker(null));

const save = (body: Record<string, unknown>) => admin.put('/api/v1/admin/settings/payments').send({ currentPassword: PASSWORD, ...body });

describe('payment settings', () => {
  it('is admin-only and never exposes secrets', async () => {
    await request(app).get('/api/v1/admin/settings/payments').expect(401);
    const res = await admin.get('/api/v1/admin/settings/payments').expect(200);
    // Tests run with environment keys configured.
    expect(res.body.payments).toMatchObject({ source: 'environment', mode: 'test', keyId: 'rzp_test_unit', webhookSecretSet: true });
    expect(JSON.stringify(res.body)).not.toContain('unit-test-key-secret');
  });

  it('requires the admin password and valid, Razorpay-accepted keys', async () => {
    await admin.put('/api/v1/admin/settings/payments').send({ keyId: 'rzp_test_ABCdef123', keySecret: 'good-secret' }).expect(400);
    await save({ keyId: 'rzp_test_ABCdef123', keySecret: 'good-secret', currentPassword: 'wrong-pass-1' }).expect(400);
    await save({ keyId: 'not_a_key', keySecret: 'good-secret' }).expect(400);
    const rejected = await save({ keyId: 'rzp_test_ABCdef123', keySecret: 'bad-secret' });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.details.keySecret[0]).toMatch(/rejected/);
    expect(await Setting.countDocuments()).toBe(0);
  });

  it('saves encrypted keys that take effect immediately, including for webhooks', async () => {
    const res = await save({ keyId: 'rzp_live_ABCdef123', keySecret: 'good-live-secret-1234', webhookSecret: 'new-webhook-secret' }).expect(200);
    expect(res.body.payments).toMatchObject({ source: 'database', mode: 'live', keyId: 'rzp_live_ABCdef123', keySecretLast4: '1234', webhookSecretSet: true });

    const stored = JSON.stringify(await Setting.findOne().lean());
    expect(stored).not.toContain('good-live-secret-1234');
    expect(stored).not.toContain('new-webhook-secret');
    expect((await getRazorpayCredentials())!.keySecret).toBe('good-live-secret-1234');
    expect(await AuditLog.countDocuments({ action: 'settings.payments_updated' })).toBe(1);

    // Webhooks are now verified with the new secret, not the old environment one.
    const body = JSON.stringify({ event: 'unknown.event', payload: {} });
    const sign = (secret: string) => createHmac('sha256', secret).update(body).digest('hex');
    const post = (sig: string) =>
      request(app).post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sig).send(body);
    await post(sign('unit-test-webhook-secret')).expect(400);
    await post(sign('new-webhook-secret')).expect(200);
  });

  it('keeps the saved secret when only other fields change, and can revert to the environment', async () => {
    await save({ keyId: 'rzp_test_ABCdef123', keySecret: 'good-secret-0001' }).expect(200);
    const kept = await save({ keyId: 'rzp_test_ABCdef123', webhookSecret: 'wh-2' }).expect(200);
    expect(kept.body.payments.keySecretLast4).toBe('0001');

    // A different Key ID needs its own secret.
    await save({ keyId: 'rzp_test_ZZZzzz999' }).expect(400);

    await admin.delete('/api/v1/admin/settings/payments').send({ currentPassword: 'nope-nope-1' }).expect(400);
    const reverted = await admin.delete('/api/v1/admin/settings/payments').send({ currentPassword: PASSWORD }).expect(200);
    expect(reverted.body.payments).toMatchObject({ source: 'environment', keyId: 'rzp_test_unit' });
  });

  it('tests the connection with the effective keys', async () => {
    setCredentialChecker(async () => ({ ok: true }));
    const res = await admin.post('/api/v1/admin/settings/payments/test').expect(200);
    expect(res.body).toMatchObject({ ok: true, message: 'Connected to Razorpay (test mode)' });
  });
});
