import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { devOutbox } from '../src/lib/email/transport';
import { AuditLog } from '../src/models/AuditLog';
import { Session } from '../src/models/Session';
import { User } from '../src/models/User';
import { ORIGIN, agent, app, createUser, lastEmailToken } from './helpers';

const PASSWORD = 'correct-horse-1';

describe('registration', () => {
  it('creates a customer, signs them in and sends a verification email', async () => {
    const a = agent();
    const res = await a.post('/api/v1/auth/register').send({ name: 'Asha', email: 'Asha@Example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@example.com', roles: ['customer'], emailVerified: false });
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await a.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asha@example.com');
    expect(devOutbox.some((m) => m.to === 'asha@example.com' && m.subject.includes('Verify'))).toBe(true);
  });

  it('stores only a hash of the session token', async () => {
    const res = await agent().post('/api/v1/auth/register').send({ name: 'Ravi', email: 'ravi@example.com', password: PASSWORD });
    const raw = /ebook_sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
    const session = await Session.findOne();
    expect(session!.tokenHash).not.toBe(raw);
    expect(session!.tokenHash).toHaveLength(64);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await createUser({ email: 'dup@example.com', password: PASSWORD });
    const dup = await agent().post('/api/v1/auth/register').send({ name: 'Dup', email: 'dup@example.com', password: PASSWORD });
    expect(dup.status).toBe(409);

    const weak = await agent().post('/api/v1/auth/register').send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.password).toBeDefined();
  });
});

describe('login and portals', () => {
  it('returns the same generic error for unknown email and wrong password', async () => {
    await createUser({ email: 'c@example.com', password: PASSWORD });
    const wrong = await agent().post('/api/v1/auth/login').send({ email: 'c@example.com', password: 'nope-nope-1' });
    const unknown = await agent().post('/api/v1/auth/login').send({ email: 'x@example.com', password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(await AuditLog.countDocuments({ action: 'auth.login_failed' })).toBe(2);
  });

  it('binds each login screen to a role', async () => {
    await createUser({ email: 'cust@example.com', password: PASSWORD, roles: ['customer'] });
    await createUser({ email: 'admin@example.com', password: PASSWORD, roles: ['admin'] });

    const custAsAdmin = await agent().post('/api/v1/auth/login').send({ email: 'cust@example.com', password: PASSWORD, portal: 'admin' });
    expect(custAsAdmin.status).toBe(403);
    expect(custAsAdmin.body.error.code).toBe('WRONG_PORTAL');
    expect(custAsAdmin.body.error.details).toEqual({ portals: ['customer'] });
    expect(custAsAdmin.headers['set-cookie']).toBeUndefined();

    const custAsAffiliate = await agent().post('/api/v1/auth/login').send({ email: 'cust@example.com', password: PASSWORD, portal: 'affiliate' });
    expect(custAsAffiliate.status).toBe(403);

    const admin = await agent().post('/api/v1/auth/login').send({ email: 'admin@example.com', password: PASSWORD, portal: 'admin' });
    expect(admin.status).toBe(200);
  });

  it('blocks suspended users', async () => {
    const user = await createUser({ email: 's@example.com', password: PASSWORD });
    await User.updateOne({ _id: user._id }, { $set: { status: 'suspended' } });
    const res = await agent().post('/api/v1/auth/login').send({ email: 's@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('logout destroys the session server-side', async () => {
    await createUser({ email: 'l@example.com', password: PASSWORD });
    const a = agent();
    await a.post('/api/v1/auth/login').send({ email: 'l@example.com', password: PASSWORD }).expect(200);
    expect(await Session.countDocuments()).toBe(1);
    await a.post('/api/v1/auth/logout').expect(200);
    expect(await Session.countDocuments()).toBe(0);
    await a.get('/api/v1/auth/me').expect(401);
  });

  it('rotates the session on re-login', async () => {
    await createUser({ email: 'r@example.com', password: PASSWORD });
    const a = agent();
    await a.post('/api/v1/auth/login').send({ email: 'r@example.com', password: PASSWORD }).expect(200);
    const first = await Session.findOne();
    await a.post('/api/v1/auth/login').send({ email: 'r@example.com', password: PASSWORD }).expect(200);
    expect(await Session.countDocuments()).toBe(1);
    expect((await Session.findOne())!._id.equals(first!._id)).toBe(false);
  });
});

describe('email verification', () => {
  it('verifies with a single-use token', async () => {
    const a = agent();
    await a.post('/api/v1/auth/register').send({ name: 'Veer', email: 'v@example.com', password: PASSWORD }).expect(201);
    const token = lastEmailToken('v@example.com');

    await agent().post('/api/v1/auth/verify-email').send({ token }).expect(200);
    const me = await a.get('/api/v1/auth/me');
    expect(me.body.user.emailVerified).toBe(true);

    const reuse = await agent().post('/api/v1/auth/verify-email').send({ token });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    const res = await agent().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(202);
    expect(devOutbox).toHaveLength(0);
  });

  it('resets the password, revokes all sessions and burns the token', async () => {
    await createUser({ email: 'p@example.com', password: PASSWORD });
    const oldDevice = agent();
    await oldDevice.post('/api/v1/auth/login').send({ email: 'p@example.com', password: PASSWORD }).expect(200);

    await agent().post('/api/v1/auth/forgot-password').send({ email: 'p@example.com' }).expect(202);
    const token = lastEmailToken('p@example.com');

    await agent().post('/api/v1/auth/reset-password').send({ token, password: 'brand-new-pass-2' }).expect(200);
    await oldDevice.get('/api/v1/auth/me').expect(401);

    await agent().post('/api/v1/auth/login').send({ email: 'p@example.com', password: PASSWORD }).expect(401);
    await agent().post('/api/v1/auth/login').send({ email: 'p@example.com', password: 'brand-new-pass-2' }).expect(200);
    await agent().post('/api/v1/auth/reset-password').send({ token, password: 'another-pass-3' }).expect(400);
  });

  it('invalidates older reset links when a new one is issued', async () => {
    await createUser({ email: 'o@example.com', password: PASSWORD });
    await agent().post('/api/v1/auth/forgot-password').send({ email: 'o@example.com' });
    const first = lastEmailToken('o@example.com');
    await agent().post('/api/v1/auth/forgot-password').send({ email: 'o@example.com' });
    await agent().post('/api/v1/auth/reset-password').send({ token: first, password: 'brand-new-pass-2' }).expect(400);
  });
});

describe('magic link', () => {
  it('signs a passwordless user in and only honours relative redirects', async () => {
    await createUser({ email: 'm@example.com' });
    await agent().post('/api/v1/auth/magic-link').send({ email: 'm@example.com', redirectTo: '/library' }).expect(202);
    const a = agent();
    const res = await a.post('/api/v1/auth/magic-login').send({ token: lastEmailToken('m@example.com') });
    expect(res.status).toBe(200);
    expect(res.body.redirectTo).toBe('/library');
    expect(res.body.user).toMatchObject({ emailVerified: true, hasPassword: false });
    await a.get('/api/v1/auth/me').expect(200);

    for (const redirectTo of ['//evil.example.com', '/\t/evil.example.com', '/\\evil.example.com', '/%2F%2Fevil.example.com', 'https://evil.example.com']) {
      await agent().post('/api/v1/auth/magic-link').send({ email: 'm@example.com', redirectTo });
      const evil = await agent().post('/api/v1/auth/magic-login').send({ token: lastEmailToken('m@example.com') });
      expect(evil.body.redirectTo, redirectTo).toBeNull();
    }
  });

  it('lets a passwordless account set its first password', async () => {
    await createUser({ email: 'np@example.com' });
    await agent().post('/api/v1/auth/magic-link').send({ email: 'np@example.com' });
    const a = agent();
    await a.post('/api/v1/auth/magic-login').send({ token: lastEmailToken('np@example.com') }).expect(200);
    const res = await a.post('/api/v1/auth/change-password').send({ newPassword: 'first-pass-1' });
    expect(res.status).toBe(200);
    expect(res.body.user.hasPassword).toBe(true);
    await agent().post('/api/v1/auth/login').send({ email: 'np@example.com', password: 'first-pass-1' }).expect(200);
  });

  it('requires the current password once one exists', async () => {
    await createUser({ email: 'cp@example.com', password: PASSWORD });
    const a = agent();
    await a.post('/api/v1/auth/login').send({ email: 'cp@example.com', password: PASSWORD });
    await a.post('/api/v1/auth/change-password').send({ newPassword: 'other-pass-1' }).expect(400);
    await a.post('/api/v1/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'other-pass-1' }).expect(200);
  });
});

describe('authorization', () => {
  it('protects admin routes by role', async () => {
    await request(app).get('/api/v1/admin/users').expect(401);

    await createUser({ email: 'cu@example.com', password: PASSWORD });
    const customer = agent();
    await customer.post('/api/v1/auth/login').send({ email: 'cu@example.com', password: PASSWORD });
    await customer.get('/api/v1/admin/users').expect(403);

    await createUser({ email: 'ad@example.com', password: PASSWORD, roles: ['admin'] });
    const admin = agent();
    await admin.post('/api/v1/auth/login').send({ email: 'ad@example.com', password: PASSWORD, portal: 'admin' });
    const list = await admin.get('/api/v1/admin/users?role=customer');
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].email).toBe('cu@example.com');
  });

  it('suspending a user revokes their sessions', async () => {
    const target = await createUser({ email: 'tg@example.com', password: PASSWORD });
    const victim = agent();
    await victim.post('/api/v1/auth/login').send({ email: 'tg@example.com', password: PASSWORD }).expect(200);

    await createUser({ email: 'ad2@example.com', password: PASSWORD, roles: ['admin'] });
    const admin = agent();
    await admin.post('/api/v1/auth/login').send({ email: 'ad2@example.com', password: PASSWORD, portal: 'admin' });
    await admin.patch(`/api/v1/admin/users/${target._id}/status`).send({ status: 'suspended' }).expect(200);
    await victim.get('/api/v1/auth/me').expect(401);
  });

  it('rejects state-changing requests from foreign origins', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'a@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(ORIGIN).toBe('http://localhost:3000');
  });

  it('returns JSON errors for malformed bodies and unknown routes', async () => {
    const bad = await agent().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    await request(app).get('/api/v1/nope').expect(404);
  });
});

describe('rate limiting', () => {
  it('locks out repeated failed logins for an email', async () => {
    process.env.DISABLE_RATE_LIMITS = '0';
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        statuses.push((await agent().post('/api/v1/auth/login').send({ email: 'brute@example.com', password: `guess-${i}x1` })).status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      process.env.DISABLE_RATE_LIMITS = '1';
    }
  });
});
