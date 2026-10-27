import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  COMMISSION_STATUSES,
  affiliateApplicationSchema,
  affiliateSignupSchema,
  payoutDetailsSchema,
  type CommissionStatus,
} from '@ebook/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { decryptField, encryptField, hashPassword } from '../../lib/crypto';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { parse } from '../../middleware/validate';
import { AffiliateClick } from '../../models/AffiliateClick';
import { AffiliateProduct } from '../../models/AffiliateProduct';
import { AffiliateProfile, type AffiliateProfileDoc } from '../../models/AffiliateProfile';
import { Commission } from '../../models/Commission';
import { Coupon } from '../../models/Coupon';
import { MembershipPass } from '../../models/MembershipPass';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Payout } from '../../models/Payout';
import { Product } from '../../models/Product';
import { User } from '../../models/User';
import { startSession } from '../auth/session';
import { calculateCommission, promotePayableCommissions } from '../commissions/ledger';
import { publicCoverUrl } from '../products/products.service';

export const affiliateRouter = Router();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = (len: number, alphabet = CODE_ALPHABET) => Array.from(randomBytes(len), (b) => alphabet[b % alphabet.length]).join('');
const LINK_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function uniqueAffiliateCode(): Promise<string> {
  for (;;) {
    const code = randomCode(7);
    if (!(await AffiliateProfile.exists({ code }))) return code;
  }
}

export function toAffiliateProfileDto(p: AffiliateProfileDoc) {
  return {
    id: p._id.toString(),
    code: p.code,
    status: p.status,
    application: {
      website: p.application?.website ?? '',
      channels: p.application?.channels ?? [],
      audienceSize: p.application?.audienceSize ?? '',
      promotionPlan: p.application?.promotionPlan ?? '',
      submittedAt: p.application?.submittedAt?.toISOString() ?? null,
    },
    payout: p.payoutDetails?.method
      ? {
          method: p.payoutDetails.method,
          upiId: p.payoutDetails.upiId ?? null,
          accountName: p.payoutDetails.accountName ?? null,
          accountNumberLast4: p.payoutDetails.accountNumberLast4 ?? null,
          ifsc: p.payoutDetails.ifsc ?? null,
        }
      : null,
    reviewNote: p.status === 'rejected' || p.status === 'suspended' ? (p.review?.note ?? null) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Apply to the program. Signed-in users apply with their account; visitors create one.
 * Applying grants the affiliate role (so they can see their status) but nothing is
 * promotable until an admin approves the profile.
 */
affiliateRouter.post('/apply', sensitiveLimiter, async (req, res) => {
  let user = req.auth?.user;
  let input;
  if (user) {
    input = parse(affiliateApplicationSchema, req.body);
  } else {
    const signup = parse(affiliateSignupSchema, req.body);
    if (await User.exists({ email: signup.email })) {
      throw conflict('An account with this email already exists. Sign in first, then apply.');
    }
    user = await User.create({ name: signup.name, email: signup.email, passwordHash: await hashPassword(signup.password), roles: ['affiliate'] });
    await startSession(req, res, user._id);
    input = signup;
  }

  const existing = await AffiliateProfile.findOne({ userId: user._id });
  if (existing && existing.status !== 'rejected') throw conflict('You have already applied to the affiliate program');

  const application = {
    website: input.website,
    channels: input.channels,
    audienceSize: input.audienceSize,
    promotionPlan: input.promotionPlan,
    submittedAt: new Date(),
  };
  const profile = existing
    ? Object.assign(existing, { status: 'pending', application, review: {} })
    : new AffiliateProfile({ userId: user._id, code: await uniqueAffiliateCode(), status: 'pending', application });
  await profile.save();
  await User.updateOne({ _id: user._id }, { $addToSet: { roles: 'affiliate' } });
  await audit({ action: 'affiliate.applied', actorId: user._id, entityType: 'AffiliateProfile', entityId: profile._id, req });
  res.status(201).json({ profile: toAffiliateProfileDto(profile) });
});

const joinSchema = z.object({
  acceptTerms: z.literal(true, { error: 'You must accept the affiliate terms' }),
});

/**
 * One-click join for customers who have bought a book: approved immediately (no application
 * form), so they can start sharing straight away. Payout details can be added later. Admins can
 * still suspend the account; a rejected or suspended profile is never re-activated this way.
 */
affiliateRouter.post('/join', requireAuth, sensitiveLimiter, async (req, res) => {
  parse(joinSchema, req.body);
  const user = req.auth!.user;
  const bought =
    (await Entitlement.exists({ userId: user._id, status: 'active', orderId: { $ne: null } })) ??
    (await MembershipPass.exists({ userId: user._id, status: 'active' }));
  if (!bought) throw forbidden('Buy an eBook first to join instantly, or apply with the affiliate form.');

  let profile = await AffiliateProfile.findOne({ userId: user._id });
  if (profile && (profile.status === 'rejected' || profile.status === 'suspended')) {
    throw forbidden('Your affiliate account is not active. Please contact support.');
  }
  const now = new Date();
  const review = { at: now, note: 'Auto-approved: joined as a customer' };
  if (!profile) {
    profile = new AffiliateProfile({
      userId: user._id,
      code: await uniqueAffiliateCode(),
      status: 'approved',
      application: { channels: [], promotionPlan: 'Joined as a customer', submittedAt: now },
      review,
    });
  } else if (profile.status === 'pending') {
    profile.status = 'approved';
    profile.set('review', review);
  }
  if (profile.isModified() || profile.isNew) {
    await profile.save();
    await audit({ action: 'affiliate.joined_as_buyer', actorId: user._id, entityType: 'AffiliateProfile', entityId: profile._id, req });
  }
  await User.updateOne({ _id: user._id }, { $addToSet: { roles: 'affiliate' } });
  res.json({ profile: toAffiliateProfileDto(profile) });
});

// Everything below requires the affiliate role.
affiliateRouter.use(requireRole('affiliate'));

async function myProfile(req: Request): Promise<AffiliateProfileDoc> {
  const profile = await AffiliateProfile.findOne({ userId: req.auth!.user._id });
  if (!profile) throw notFound('You have not applied to the affiliate program yet');
  return profile;
}

async function myApprovedProfile(req: Request): Promise<AffiliateProfileDoc> {
  const profile = await myProfile(req);
  if (profile.status !== 'approved') {
    throw forbidden(profile.status === 'pending' ? 'Your application is still under review' : 'Your affiliate account is not active');
  }
  return profile;
}

affiliateRouter.get('/me', async (req, res) => {
  res.json({ profile: toAffiliateProfileDto(await myProfile(req)) });
});

affiliateRouter.put('/me/payout', async (req, res) => {
  const profile = await myProfile(req);
  if (await Payout.exists({ affiliateId: profile._id, open: true })) {
    throw new HttpError(409, 'PAYOUT_IN_PROGRESS', 'Payout details cannot be changed while a payout request is open');
  }
  const details = parse(payoutDetailsSchema, req.body);
  profile.set(
    'payoutDetails',
    details.method === 'upi'
      ? { method: 'upi', upiId: details.upiId, updatedAt: new Date() }
      : {
          method: 'bank_transfer',
          accountName: details.accountName,
          accountNumberEnc: encryptField(details.accountNumber),
          accountNumberLast4: details.accountNumber.slice(-4),
          ifsc: details.ifsc,
          updatedAt: new Date(),
        },
  );
  await profile.save();
  await audit({ action: 'affiliate.payout_details_updated', entityType: 'AffiliateProfile', entityId: profile._id, meta: { method: details.method }, req });
  res.json({ profile: toAffiliateProfileDto(profile) });
});

/** Eligible eBooks with the commission the affiliate earns per sale and their link, if created. */
affiliateRouter.get('/products', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const products = await Product.find({ status: 'published', 'affiliate.enabled': true }).sort({ featured: -1, publishedAt: -1 });
  const links = await AffiliateProduct.find({ affiliateId: profile._id, productId: { $in: products.map((p) => p._id) } });
  const linkBy = new Map(links.map((l) => [l.productId.toString(), l]));

  res.json({
    items: products.map((p) => {
      const link = linkBy.get(p._id.toString());
      const rule = { type: p.affiliate?.type ?? 'percent', value: p.affiliate?.value ?? 0 } as const;
      return {
        productId: p._id.toString(),
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle ?? '',
        author: p.author ?? '',
        description: p.description ?? '',
        coverUrl: publicCoverUrl(p),
        pricePaise: p.pricePaise,
        effectivePricePaise: p.effectivePricePaise,
        commission: { ...rule, perSalePaise: calculateCommission(p.effectivePricePaise, rule) },
        link: link ? { code: link.linkCode, url: `${env.APP_URL}/r/${link.linkCode}`, clicks: link.clicks } : null,
      };
    }),
  });
});

const linkBody = z.object({ productId: z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid eBook') });

affiliateRouter.post('/links', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const { productId } = parse(linkBody, req.body);
  const product = await Product.findOne({ _id: productId, status: 'published', 'affiliate.enabled': true });
  if (!product) throw notFound('This eBook is not available for promotion');

  let link = await AffiliateProduct.findOne({ affiliateId: profile._id, productId: product._id });
  while (!link) {
    try {
      link = await AffiliateProduct.create({ affiliateId: profile._id, productId: product._id, linkCode: randomCode(8, LINK_ALPHABET) });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      // Either a code collision (retry) or a concurrent create for the same product (re-read).
      link = await AffiliateProduct.findOne({ affiliateId: profile._id, productId: product._id });
    }
  }
  res.status(201).json({ link: { code: link.linkCode, url: `${env.APP_URL}/r/${link.linkCode}`, clicks: link.clicks } });
});

/** Coupon codes the admin gave this affiliate: sales using them are credited to the affiliate. */
affiliateRouter.get('/coupons', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const now = new Date();
  const coupons = await Coupon.find({ affiliateId: profile._id, active: true, $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).sort({ createdAt: -1 });
  res.json({
    items: coupons.map((c) => ({
      code: c.code,
      description: c.description ?? '',
      type: c.type,
      percentOff: c.percentOff ?? null,
      amountOffPaise: c.amountOffPaise ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      url: `${env.APP_URL}/ebooks?coupon=${encodeURIComponent(c.code)}`,
    })),
  });
});

const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

affiliateRouter.get('/stats', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const { days } = parse(statsQuery, req.query);
  await promotePayableCommissions();
  const since = new Date(Date.now() - days * 86_400_000);
  const affiliateId = profile._id;

  const [clicks, uniqueVisitors, orders, earnings, dailyClicks, dailySales, perProduct] = await Promise.all([
    AffiliateClick.countDocuments({ affiliateId, createdAt: { $gte: since } }),
    AffiliateClick.distinct('visitorId', { affiliateId, createdAt: { $gte: since } }).then((v) => v.length),
    Order.countDocuments({ 'attribution.affiliateId': affiliateId, status: { $in: ['paid', 'partially_refunded'] }, paidAt: { $gte: since } }),
    Commission.aggregate<{ _id: CommissionStatus; total: number; count: number }>([
      { $match: { affiliateId } },
      { $group: { _id: '$status', total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
    AffiliateClick.aggregate<{ _id: string; count: number }>([
      { $match: { affiliateId, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
    ]),
    Commission.aggregate<{ _id: string; count: number; earned: number }>([
      { $match: { affiliateId, createdAt: { $gte: since }, status: { $ne: 'reversed' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          count: { $sum: 1 },
          earned: { $sum: '$amountPaise' },
        },
      },
    ]),
    AffiliateProduct.aggregate<{ productId: Types.ObjectId; title: string; clicks: number }>([
      { $match: { affiliateId } },
      { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'p' } },
      { $project: { productId: 1, clicks: 1, title: { $first: '$p.title' } } },
    ]),
  ]);

  const salesByProduct = await Commission.aggregate<{ _id: Types.ObjectId; sales: number; earned: number }>([
    { $match: { affiliateId, status: { $ne: 'reversed' } } },
    { $group: { _id: '$productId', sales: { $sum: 1 }, earned: { $sum: '$amountPaise' } } },
  ]);
  const salesBy = new Map(salesByProduct.map((s) => [s._id.toString(), s]));

  const byStatus = Object.fromEntries(COMMISSION_STATUSES.map((s) => [s, { amountPaise: 0, count: 0 }])) as Record<CommissionStatus, { amountPaise: number; count: number }>;
  for (const e of earnings) byStatus[e._id] = { amountPaise: e.total, count: e.count };

  // A continuous day series (IST) so charts have no gaps.
  const clicksBy = new Map(dailyClicks.map((d) => [d._id, d.count]));
  const salesByDay = new Map(dailySales.map((d) => [d._id, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return { date, clicks: clicksBy.get(date) ?? 0, sales: salesByDay.get(date)?.count ?? 0, earnedPaise: salesByDay.get(date)?.earned ?? 0 };
  });

  res.json({
    days,
    clicks,
    uniqueVisitors,
    sales: orders,
    conversionRate: uniqueVisitors ? Math.round((orders / uniqueVisitors) * 1000) / 10 : 0,
    earnings: byStatus,
    series,
    products: perProduct
      .map((p) => ({
        productId: p.productId.toString(),
        title: p.title ?? 'Removed eBook',
        clicks: p.clicks,
        sales: salesBy.get(p.productId.toString())?.sales ?? 0,
        earnedPaise: salesBy.get(p.productId.toString())?.earned ?? 0,
      }))
      .sort((a, b) => b.earnedPaise - a.earnedPaise || b.clicks - a.clicks),
  });
});

const commissionQuery = z.object({
  status: z.enum(COMMISSION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

affiliateRouter.get('/commissions', async (req, res) => {
  const profile = await myProfile(req);
  await promotePayableCommissions();
  const { status, page, pageSize } = parse(commissionQuery, req.query);
  const filter = { affiliateId: profile._id, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Commission.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    Commission.countDocuments(filter),
  ]);
  const orders = await Order.find({ _id: { $in: items.map((c) => c.orderId) } }).select('orderNumber productSnapshot');
  const orderBy = new Map(orders.map((o) => [o._id.toString(), o]));
  res.json({
    items: items.map((c) => ({
      id: c._id.toString(),
      orderNumber: orderBy.get(c.orderId.toString())?.orderNumber ?? '',
      productTitle: orderBy.get(c.orderId.toString())?.productSnapshot?.title ?? '',
      baseAmountPaise: c.baseAmountPaise,
      rule: c.rule,
      amountPaise: c.amountPaise,
      status: c.status,
      holdUntil: c.holdUntil.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
  });
});

export function toPayoutDto(p: InstanceType<typeof Payout>) {
  return {
    id: p._id.toString(),
    amountPaise: p.amountPaise,
    commissionCount: p.commissionIds.length,
    status: p.status,
    method: p.method ?? null,
    destination: p.destination ?? null,
    reference: p.reference ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    adminNote: p.adminNote ?? null,
    affiliateNote: p.affiliateNote ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

affiliateRouter.get('/payouts', async (req, res) => {
  const profile = await myProfile(req);
  await promotePayableCommissions();
  const [items, payable] = await Promise.all([
    Payout.find({ affiliateId: profile._id }).sort({ createdAt: -1 }).limit(100),
    Commission.aggregate<{ total: number; count: number }>([
      { $match: { affiliateId: profile._id, status: 'payable' } },
      { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    payablePaise: payable[0]?.total ?? 0,
    payableCount: payable[0]?.count ?? 0,
    minimumPaise: env.MIN_PAYOUT_PAISE,
    hasPayoutDetails: Boolean(profile.payoutDetails?.method),
    items: items.map(toPayoutDto),
  });
});

const payoutRequest = z.object({ note: z.string().trim().max(300).default('') });

/**
 * Requests payment of every payable commission. Commissions are claimed atomically
 * (payable → processing with this payout's id), so concurrent requests cannot include the
 * same commission twice.
 */
affiliateRouter.post('/payouts', sensitiveLimiter, async (req, res) => {
  const profile = await myApprovedProfile(req);
  const { note } = parse(payoutRequest, req.body);
  if (!profile.payoutDetails?.method) throw badRequest('Add your payout details before requesting a payout');
  if (await Payout.exists({ affiliateId: profile._id, status: { $in: ['requested', 'processing'] } })) {
    throw new HttpError(409, 'PAYOUT_IN_PROGRESS', 'You already have a payout request in progress');
  }
  await promotePayableCommissions();

  const payoutId = new Types.ObjectId();
  const now = new Date();
  await Commission.updateMany(
    { affiliateId: profile._id, status: 'payable' },
    { $set: { status: 'processing', payoutId }, $push: { history: { status: 'processing', at: now, by: req.auth!.user._id, note: 'Included in payout request' } } },
  );
  const claimed = await Commission.find({ payoutId }).select('amountPaise');
  const amountPaise = claimed.reduce((s, c) => s + c.amountPaise, 0);

  if (amountPaise < env.MIN_PAYOUT_PAISE || claimed.length === 0) {
    await Commission.updateMany(
      { payoutId, status: 'processing' },
      { $set: { status: 'payable', payoutId: null }, $push: { history: { status: 'payable', at: new Date(), by: null, note: 'Payout request below minimum — released' } } },
    );
    throw badRequest(`You need at least ₹${(env.MIN_PAYOUT_PAISE / 100).toFixed(0)} in payable commissions to request a payout`);
  }

  const d = profile.payoutDetails;
  const full = await AffiliateProfile.findById(profile._id).select('+payoutDetails.accountNumberEnc');
  const snapshot = encryptField(
    JSON.stringify({
      method: d.method,
      upiId: d.upiId ?? null,
      accountName: d.accountName ?? null,
      accountNumber: full?.payoutDetails?.accountNumberEnc ? decryptField(full.payoutDetails.accountNumberEnc) : null,
      ifsc: d.ifsc ?? null,
    }),
  );
  let payout;
  try {
    payout = await Payout.create({
    _id: payoutId,
      affiliateId: profile._id,
      amountPaise,
      commissionIds: claimed.map((c) => c._id),
      status: 'requested',
      method: d.method,
      destination: d.method === 'upi' ? `UPI ${d.upiId}` : `Bank ${d.accountName} ••••${d.accountNumberLast4} ${d.ifsc}`,
      destinationEnc: snapshot,
      affiliateNote: note || undefined,
    });
  } catch (err) {
    // A concurrent request won the one-open-payout index: release what this request claimed.
    await Commission.updateMany({ payoutId, status: 'processing' }, { $set: { status: 'payable', payoutId: null } });
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, 'PAYOUT_IN_PROGRESS', 'You already have a payout request in progress');
    throw err;
  }
  await audit({ action: 'payout.requested', entityType: 'Payout', entityId: payout._id, meta: { amountPaise }, req });
  res.status(201).json({ payout: toPayoutDto(payout) });
});
