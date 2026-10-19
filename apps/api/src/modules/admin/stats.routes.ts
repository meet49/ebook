import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../middleware/validate';
import { AffiliateProfile } from '../../models/AffiliateProfile';
import { AuditLog } from '../../models/AuditLog';
import { Commission } from '../../models/Commission';
import { Order } from '../../models/Order';
import { Payout } from '../../models/Payout';
import { Product } from '../../models/Product';
import { User } from '../../models/User';
import { promotePayableCommissions } from '../commissions/ledger';

export const adminStatsRouter = Router();

const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });
const SOLD = ['paid', 'partially_refunded', 'refunded'];

adminStatsRouter.get('/stats', async (req, res) => {
  const { days } = parse(statsQuery, req.query);
  await promotePayableCommissions();
  const since = new Date(Date.now() - days * 86_400_000);

  const [revenue, daily, topProducts, customers, affiliates, pendingAffiliates, commissions, openPayouts, products] = await Promise.all([
    Order.aggregate<{ gross: number; refunded: number; orders: number; affiliateOrders: number }>([
      { $match: { status: { $in: SOLD }, paidAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          gross: { $sum: '$amountPaise' },
          refunded: { $sum: '$refundedPaise' },
          orders: { $sum: 1 },
          affiliateOrders: { $sum: { $cond: [{ $eq: ['$attribution.type', 'affiliate'] }, 1, 0] } },
        },
      },
    ]),
    Order.aggregate<{ _id: string; revenue: number; orders: number }>([
      { $match: { status: { $in: SOLD }, paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Kolkata' } },
          revenue: { $sum: { $subtract: ['$amountPaise', '$refundedPaise'] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate<{ _id: string; title: string; orders: number; revenue: number }>([
      { $match: { status: { $in: SOLD }, paidAt: { $gte: since } } },
      // One row per book; orders made before combos have no lines, so their main book stands in.
      {
        $project: {
          refundedPaise: 1,
          amountPaise: 1,
          lines: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] },
              '$items',
              [{ productId: '$productId', title: '$productSnapshot.title', pricePaise: '$amountPaise' }],
            ],
          },
        },
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.productId',
          title: { $first: '$lines.title' },
          orders: { $sum: 1 },
          // Refunds are shared across a combo's books in proportion to their price.
          revenue: {
            $sum: {
              $subtract: [
                '$lines.pricePaise',
                { $divide: [{ $multiply: ['$lines.pricePaise', { $ifNull: ['$refundedPaise', 0] }] }, { $max: ['$amountPaise', 1] }] },
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    User.countDocuments({ roles: 'customer' }),
    AffiliateProfile.countDocuments({ status: 'approved' }),
    AffiliateProfile.countDocuments({ status: 'pending' }),
    Commission.aggregate<{ _id: string; amount: number }>([{ $group: { _id: '$status', amount: { $sum: '$amountPaise' } } }]),
    Payout.countDocuments({ status: { $in: ['requested', 'processing'] } }),
    Product.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  const r = revenue[0] ?? { gross: 0, refunded: 0, orders: 0, affiliateOrders: 0 };
  const dailyBy = new Map(daily.map((d) => [d._id, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return { date, revenuePaise: dailyBy.get(date)?.revenue ?? 0, orders: dailyBy.get(date)?.orders ?? 0 };
  });

  res.json({
    days,
    revenue: { grossPaise: r.gross, refundedPaise: r.refunded, netPaise: r.gross - r.refunded, orders: r.orders, affiliateOrders: r.affiliateOrders },
    series,
    topProducts: topProducts.map((p) => ({ productId: String(p._id), title: p.title, orders: p.orders, revenuePaise: Math.round(p.revenue) })),
    customers,
    affiliates: { approved: affiliates, pending: pendingAffiliates },
    commissions: Object.fromEntries(commissions.map((c) => [c._id, c.amount])),
    openPayouts,
    products: Object.fromEntries(products.map((p) => [p._id, p.n])),
  });
});

const auditQuery = z.object({
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

adminStatsRouter.get('/audit', async (req, res) => {
  const { action, page, pageSize } = parse(auditQuery, req.query);
  const filter = action ? { action: { $regex: `^${action.replace(/[^a-z_.]/gi, '')}` } } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    AuditLog.countDocuments(filter),
  ]);
  const actors = await User.find({ _id: { $in: items.flatMap((i) => (i.actorId ? [i.actorId] : [])) } }).select('email');
  const emailBy = new Map(actors.map((a) => [a._id.toString(), a.email]));
  res.json({
    items: items.map((i) => ({
      id: i._id.toString(),
      action: i.action,
      actor: i.actorId ? (emailBy.get(i.actorId.toString()) ?? i.actorId.toString()) : null,
      entity: i.entity?.type ? { type: i.entity.type, id: i.entity.id?.toString() ?? null } : null,
      meta: i.meta ?? null,
      ip: i.ip ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
  });
});
