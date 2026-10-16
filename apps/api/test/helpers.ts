import request from 'supertest';
import { createApp } from '../src/app';
import { hashPassword } from '../src/lib/crypto';
import { devOutbox } from '../src/lib/email/transport';
import { User } from '../src/models/User';
import type { Role } from '@ebook/shared';

export const app = createApp();
export const ORIGIN = 'http://localhost:3000';

export function agent() {
  return request.agent(app).set('Origin', ORIGIN);
}

export async function createUser(opts: { email: string; password?: string; roles?: Role[]; name?: string }) {
  return User.create({
    name: opts.name ?? 'Test User',
    email: opts.email,
    passwordHash: opts.password ? await hashPassword(opts.password) : undefined,
    roles: opts.roles ?? ['customer'],
  });
}

/** Pulls the single-use token out of the most recent email sent to `to`. */
export function lastEmailToken(to: string): string {
  const msg = [...devOutbox].reverse().find((m) => m.to === to);
  if (!msg) throw new Error(`No email sent to ${to}`);
  const match = /token=([A-Za-z0-9_-]+)/.exec(msg.text);
  if (!match?.[1]) throw new Error('No token in email');
  return match[1];
}
