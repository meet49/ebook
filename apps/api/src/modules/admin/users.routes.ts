import { Router } from 'express';
import { z } from 'zod';
import { ROLES, USER_STATUSES } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { User, toPublicUser } from '../../models/User';
import { revokeAllSessions } from '../auth/session';

export const adminUsersRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

adminUsersRouter.get('/', async (req, res) => {
  const { q, role, page, pageSize } = parse(listQuery, req.query);
  const filter: Record<string, unknown> = {};
  if (role) filter.roles = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: rx }, { name: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select('+passwordHash').sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    User.countDocuments(filter),
  ]);

  res.json({
    items: items.map((u) => toPublicUser(u, Boolean(u.passwordHash))),
    page,
    pageSize,
    total,
  });
});

const statusBody = z.object({ status: z.enum(USER_STATUSES) });

adminUsersRouter.patch('/:id/status', async (req, res) => {
  const { status } = parse(statusBody, req.body);
  if (req.params.id === req.auth!.user._id.toString()) throw badRequest('You cannot change your own status');

  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) throw notFound('User not found');

  user.status = status;
  await user.save();
  if (status === 'suspended') await revokeAllSessions(user._id);
  await audit({ action: `admin.user_${status}`, entityType: 'User', entityId: user._id, req });
  res.json({ user: toPublicUser(user, Boolean(user.passwordHash)) });
});
