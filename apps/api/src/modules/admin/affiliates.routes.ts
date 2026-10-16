import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AFFILIATE_STATUSES, COMMISSION_STATUSES, PAYOUT_STATUSES, formatINR } from '@ebook/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { decryptField } from '../../lib/crypto';
import { sendEmailInBackground } from '../../lib/email/transport';
import { affiliateDecisionTemplate, payoutPaidTemplate } from '../../lib/email/templates';
import { HttpError, notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { AffiliateClick } from '../../models/AffiliateClick';
import { AffiliateProfile, type AffiliateProfileDoc } from '../../models/AffiliateProfile';
import { Commission } from '../../models/Commission';
import { Notification } from '../../models/Notification';
import { Order } from '../../models/Order';
import { Payout } from '../../models/Payout';
import { User } from '../../models/User';
import { toAffiliateProfileDto, toPayoutDto } from '../affiliates/affiliate.routes';
import { promotePayableCommissions, transitionCommission } from '../commissions/ledger';

function objectId(req: Request, label: string): Types.ObjectId {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw notFound(`${label} not found`);
  return new Types.ObjectId(id);
}

// ─── Affiliates ─────────────────────────────────────────────────────────

export const adminAffiliatesRouter = Router();

const affiliateList = z.object({
  status: z.enum(AFFILIATE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

adminAffiliatesRouter.get('/', async (req, res) => {
  const { status, page, pageSize } = parse(affiliateList, req.query);
  const filter = status ? { status } : {};
  const [profiles, total] = await Promise.all([
    AffiliateProfile.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    AffiliateProfile.countDocuments(filter),
  ]);
  const ids = profiles.map((p) => p._id);
  const [users, clicks, earnings] = await Promise.all([
    User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name email'),
    AffiliateClick.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { affiliateId: { $in: ids } } }, { $group: { _id: '$affiliateId', n: { $sum: 1 } } }]),
    Commission.aggregate<{ _id: Types.ObjectId; sales: number; earned: number }>([
      { $match: { affiliateId: { $in: ids }, status: { $ne: 'reversed' } } },
      { $group: { _id: '$affiliateId', sales: { $sum: 1 }, earned: { $sum: '$amountPaise' } } },
    ]),
  ]);
  const userBy = new Map(users.map((u) => [u._id.toString(), u]));
  const clickBy = new Map(clicks.map((c) => [c._id.toString(), c.n]));
  const earnBy = new Map(earnings.map((e) => [e._id.toString(), e]));
  res.json({
    items: profiles.map((p) => ({
      ...toAffiliateProfileDto(p),
      user: { name: userBy.get(p.userId.toString())?.name ?? '', email: userBy.get(p.userId.toString())?.email ?? '' },
      reviewNote: p.review?.note ?? null,
      stats: { clicks: clickBy.get(p._id.toString()) ?? 0, sales: earnBy.get(p._id.toString())?.sales ?? 0, earnedPaise: earnBy.get(p._id.toString())?.earned ?? 0 },
    })),
    page,
    pageSize,
    total,
  });
});

const decisionBody = z.object({ note: z.string().trim().max(500).default('') });

const DECISIONS = {
  approve: { from: ['pending', 'rejected'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  suspend: { from: ['approved'], to: 'suspended' },
  reinstate: { from: ['suspended'], to: 'approved' },
} as const;

for (const [action, rule] of Object.entries(DECISIONS)) {
  adminAffiliatesRouter.post(`/:id/${action}`, async (req, res) => {
    const { note } = parse(decisionBody, req.body);
    const profile = await AffiliateProfile.findById(objectId(req, 'Affiliate'));
    if (!profile) throw notFound('Affiliate not found');
    if (!(rule.from as readonly string[]).includes(profile.status)) {
      throw new HttpError(409, 'INVALID_STATUS', `A ${profile.status} affiliate cannot be ${action === 'reinstate' ? 'reinstated' : `${action}d`}`);
    }
    profile.status = rule.to;
    profile.set('review', { by: req.auth!.user._id, at: new Date(), note: note || undefined });
    await profile.save();
    await audit({ action: `affiliate.${action}`, entityType: 'AffiliateProfile', entityId: profile._id, meta: { note }, req });

    const user = await User.findById(profile.userId);
    if (user && (action === 'approve' || action === 'reject')) {
      sendEmailInBackground(affiliateDecisionTemplate(user.email, { name: user.name, approved: action === 'approve', note, url: `${env.APP_URL}/affiliate` }));
      await Notification.create({
        userId: user._id,
        type: `affiliate.${action}`,
        title: action === 'approve' ? 'Your affiliate application was approved' : 'Your affiliate application was not approved',
        body: note || undefined,
        link: '/affiliate',
      });
    }
    res.json({ profile: toAffiliateProfileDto(profile as AffiliateProfileDoc) });
  });
}

// ─── Commission ledger ──────────────────────────────────────────────────

export const adminCommissionsRouter = Router();

const commissionList = z.object({
  status: z.enum(COMMISSION_STATUSES).optional(),
  affiliateId: z.string().refine((v) => Types.ObjectId.isValid(v)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

adminCommissionsRouter.get('/', async (req, res) => {
  await promotePayableCommissions();
  const { status, affiliateId, page, pageSize } = parse(commissionList, req.query);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (affiliateId) filter.affiliateId = new Types.ObjectId(affiliateId);
  const [items, total, totals] = await Promise.all([
    Commission.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Commission.countDocuments(filter),
    Commission.aggregate<{ _id: string; amount: number; count: number }>([{ $group: { _id: '$status', amount: { $sum: '$amountPaise' }, count: { $sum: 1 } } }]),
  ]);
  const [orders, profiles] = await Promise.all([
    Order.find({ _id: { $in: items.map((c) => c.orderId) } }).select('orderNumber productSnapshot status'),
    AffiliateProfile.find({ _id: { $in: items.map((c) => c.affiliateId) } }).select('code'),
  ]);
  const orderBy = new Map(orders.map((o) => [o._id.toString(), o]));
  const codeBy = new Map(profiles.map((p) => [p._id.toString(), p.code]));
  res.json({
    items: items.map((c) => ({
      id: c._id.toString(),
      affiliateCode: codeBy.get(c.affiliateId.toString()) ?? '',
      orderNumber: orderBy.get(c.orderId.toString())?.orderNumber ?? '',
      orderStatus: orderBy.get(c.orderId.toString())?.status ?? '',
      productTitle: orderBy.get(c.orderId.toString())?.productSnapshot?.title ?? '',
      baseAmountPaise: c.baseAmountPaise,
      rule: c.rule,
      amountPaise: c.amountPaise,
      status: c.status,
      holdUntil: c.holdUntil.toISOString(),
      clawbackRequired: c.clawbackRequired,
      history: c.history.map((h) => ({ status: h.status, at: h.at.toISOString(), note: h.note ?? null })),
      createdAt: c.createdAt.toISOString(),
    })),
    totals: Object.fromEntries(totals.map((t) => [t._id, { amountPaise: t.amount, count: t.count }])),
    page,
    pageSize,
    total,
  });
});

const idsBody = z.object({ ids: z.array(z.string().refine((v) => Types.ObjectId.isValid(v))).min(1).max(200) });

/** Approves pending commissions. They become payable automatically once the refund hold ends. */
adminCommissionsRouter.post('/approve', async (req, res) => {
  const { ids } = parse(idsBody, req.body);
  let approved = 0;
  for (const id of ids) {
    const c = await Commission.findById(id).select('orderId status');
    if (!c || c.status !== 'pending') continue;
    const order = await Order.findById(c.orderId).select('status');
    // Never approve commission on an order that is no longer paid.
    if (!order || !['paid', 'partially_refunded'].includes(order.status)) continue;
    if (await transitionCommission(c._id, ['pending'], 'approved', 'Approved by admin', req.auth!.user._id)) approved++;
  }
  const payable = await promotePayableCommissions();
  await audit({ action: 'commission.approved', meta: { requested: ids.length, approved }, req });
  res.json({ approved, nowPayable: payable });
});

const reverseBody = z.object({ note: z.string().trim().min(3, 'Give a reason').max(300) });

adminCommissionsRouter.post('/:id/reverse', async (req, res) => {
  const { note } = parse(reverseBody, req.body);
  const id = objectId(req, 'Commission');
  const ok = await transitionCommission(id, ['pending', 'approved', 'payable'], 'reversed', `Reversed by admin: ${note}`, req.auth!.user._id);
  if (!ok) throw new HttpError(409, 'INVALID_STATUS', 'Only unpaid commissions that are not part of a payout can be reversed');
  await audit({ action: 'commission.reversed', entityType: 'Commission', entityId: id, meta: { note }, req });
  res.json({ ok: true });
});

// ─── Payouts ────────────────────────────────────────────────────────────

export const adminPayoutsRouter = Router();

const payoutList = z.object({
  status: z.enum(PAYOUT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

adminPayoutsRouter.get('/', async (req, res) => {
  const { status, page, pageSize } = parse(payoutList, req.query);
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Payout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Payout.countDocuments(filter),
  ]);
  const profiles = await AffiliateProfile.find({ _id: { $in: items.map((p) => p.affiliateId) } }).select('code userId');
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name email');
  const profileBy = new Map(profiles.map((p) => [p._id.toString(), p]));
  const userBy = new Map(users.map((u) => [u._id.toString(), u]));
  res.json({
    items: items.map((p) => {
      const profile = profileBy.get(p.affiliateId.toString());
      const user = profile ? userBy.get(profile.userId.toString()) : undefined;
      return { ...toPayoutDto(p), affiliate: { code: profile?.code ?? '', name: user?.name ?? '', email: user?.email ?? '' } };
    }),
    page,
    pageSize,
    total,
  });
});

/** Full payout destination (bank number decrypted) for the admin making the transfer. */
adminPayoutsRouter.get('/:id/destination', async (req, res) => {
  const payout = await Payout.findById(objectId(req, 'Payout')).select('+destinationEnc');
  if (!payout) throw notFound('Payout not found');
  await audit({ action: 'payout.destination_viewed', entityType: 'Payout', entityId: payout._id, req });
  res.setHeader('Cache-Control', 'no-store');
  // Always the destination frozen when the payout was requested, never the current profile.
  const snapshot = payout.destinationEnc ? (JSON.parse(decryptField(payout.destinationEnc)) as Record<string, string | null>) : null;
  res.json({
    method: snapshot?.method ?? null,
    upiId: snapshot?.upiId ?? null,
    accountName: snapshot?.accountName ?? null,
    accountNumber: snapshot?.accountNumber ?? null,
    ifsc: snapshot?.ifsc ?? null,
  });
});

const markPaidBody = z.object({
  reference: z.string().trim().min(4, 'Enter the bank/UPI transaction reference').max(100),
  note: z.string().trim().max(300).default(''),
});

/**
 * Records a payout the admin has ALREADY completed outside the platform. Status becomes
 * "paid" only with a real transaction reference; the platform never moves money itself.
 */
adminPayoutsRouter.post('/:id/mark-paid', async (req, res) => {
  const { reference, note } = parse(markPaidBody, req.body);
  const id = objectId(req, 'Payout');
  const payout = await Payout.findOneAndUpdate(
    { _id: id, status: { $in: ['requested', 'processing'] }, amountPaise: { $gt: 0 } },
    { $set: { status: 'paid', open: false, reference, paidAt: new Date(), processedBy: req.auth!.user._id, adminNote: note || undefined } },
    { returnDocument: 'after' },
  );
  if (!payout) throw new HttpError(409, 'INVALID_STATUS', 'This payout is not awaiting payment (or nothing is left to pay — reject it instead)');

  await Commission.updateMany(
    { payoutId: payout._id, status: 'processing' },
    { $set: { status: 'paid' }, $push: { history: { status: 'paid', at: new Date(), by: req.auth!.user._id, note: `Paid in payout (ref ${reference})` } } },
  );
  await audit({ action: 'payout.paid', entityType: 'Payout', entityId: payout._id, meta: { reference, amountPaise: payout.amountPaise }, req });

  const profile = await AffiliateProfile.findById(payout.affiliateId).select('userId');
  const user = profile ? await User.findById(profile.userId) : null;
  if (user) {
    sendEmailInBackground(payoutPaidTemplate(user.email, { name: user.name, amount: formatINR(payout.amountPaise), reference, url: `${env.APP_URL}/affiliate/payouts` }));
  }
  res.json({ payout: toPayoutDto(payout) });
});

adminPayoutsRouter.post('/:id/start', async (req, res) => {
  const payout = await Payout.findOneAndUpdate({ _id: objectId(req, 'Payout'), status: 'requested' }, { $set: { status: 'processing' } }, { returnDocument: 'after' });
  if (!payout) throw new HttpError(409, 'INVALID_STATUS', 'Only requested payouts can be started');
  await audit({ action: 'payout.processing', entityType: 'Payout', entityId: payout._id, req });
  res.json({ payout: toPayoutDto(payout) });
});

const rejectBody = z.object({ note: z.string().trim().min(3, 'Give a reason').max(300) });

/** Rejecting releases the commissions back to payable so they can be requested again. */
adminPayoutsRouter.post('/:id/reject', async (req, res) => {
  const { note } = parse(rejectBody, req.body);
  const payout = await Payout.findOneAndUpdate(
    { _id: objectId(req, 'Payout'), status: { $in: ['requested', 'processing'] } },
    { $set: { status: 'rejected', open: false, adminNote: note, processedBy: req.auth!.user._id } },
    { returnDocument: 'after' },
  );
  if (!payout) throw new HttpError(409, 'INVALID_STATUS', 'This payout can no longer be rejected');
  await Commission.updateMany(
    { payoutId: payout._id, status: 'processing' },
    { $set: { status: 'payable', payoutId: null }, $push: { history: { status: 'payable', at: new Date(), by: req.auth!.user._id, note: `Payout rejected: ${note}` } } },
  );
  await audit({ action: 'payout.rejected', entityType: 'Payout', entityId: payout._id, meta: { note }, req });
  res.json({ payout: toPayoutDto(payout) });
});

