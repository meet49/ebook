import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AuthorEarning } from '../../models/AuthorEarning';
import { AuthorProfile } from '../../models/AuthorProfile';
import { Commission } from '../../models/Commission';
import type { OrderDoc } from '../../models/Order';
import type { ProductDoc } from '../../models/Product';
import { orderLines } from '../checkout/lines';
import { calculateCommission } from '../commissions/ledger';

/**
 * An author's share of one book: what was charged for it, less the affiliate commission on it
 * (when the sale earned one), times the author's share. The rest stays with the platform.
 *   ₹200 book, 20% affiliate commission (₹40), 70% share → ₹112 to the author.
 */
export function authorShare(pricePaise: number, commissionPaise: number, sharePercent: number): number {
  return Math.floor((Math.max(0, pricePaise - commissionPaise) * Math.min(Math.max(sharePercent, 0), 100)) / 100);
}

/** Author and share to snapshot on each order line, for books written by marketplace authors. */
export async function authorSnapshots(products: ProductDoc[]): Promise<Map<string, { authorProfileId: Types.ObjectId; sharePercent: number }>> {
  const ids = products.flatMap((p) => (p.authorProfileId ? [p.authorProfileId] : []));
  if (!ids.length) return new Map();
  const authors = await AuthorProfile.find({ _id: { $in: ids } }).select('sharePercent');
  const shareBy = new Map(authors.map((a) => [a._id.toString(), a.sharePercent]));
  const out = new Map<string, { authorProfileId: Types.ObjectId; sharePercent: number }>();
  for (const p of products) {
    const share = p.authorProfileId ? shareBy.get(p.authorProfileId.toString()) : undefined;
    if (p.authorProfileId && share != null) out.set(p._id.toString(), { authorProfileId: p.authorProfileId, sharePercent: share });
  }
  return out;
}

/** Records each author's earnings from a paid order, held for the refund window. Safe to call repeatedly. */
export async function createAuthorEarningsForOrder(order: OrderDoc): Promise<void> {
  const lines = orderLines(order).filter((l) => l.authorProfileId && l.authorSharePercent != null);
  if (!lines.length) return;
  // The affiliate's commission comes off first, but only when the sale actually earned one.
  const commissioned = (await Commission.exists({ orderId: order._id })) !== null;
  const paidAt = order.paidAt ?? new Date();

  const byAuthor = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = l.authorProfileId!.toString();
    byAuthor.set(key, [...(byAuthor.get(key) ?? []), l]);
  }
  for (const [authorId, mine] of byAuthor) {
    const entries = mine.map((l) => {
      const commissionPaise = commissioned && l.commissionRule ? calculateCommission(l.pricePaise, l.commissionRule) : 0;
      return {
        productId: l.productId,
        title: l.title,
        pricePaise: l.pricePaise,
        commissionPaise,
        sharePercent: l.authorSharePercent!,
        amountPaise: authorShare(l.pricePaise, commissionPaise, l.authorSharePercent!),
      };
    });
    const amountPaise = entries.reduce((s, e) => s + e.amountPaise, 0);
    if (amountPaise <= 0) continue;
    try {
      await AuthorEarning.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        authorProfileId: new Types.ObjectId(authorId),
        lines: entries,
        originalAmountPaise: amountPaise,
        amountPaise,
        status: 'pending',
        holdUntil: new Date(paidAt.getTime() + env.COMMISSION_HOLD_DAYS * 86_400_000),
        history: [{ status: 'pending', at: paidAt, note: 'Paid order' }],
      });
    } catch (err) {
      // Unique on (order, author): already recorded by an earlier verify or webhook.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
}

/**
 * Shrinks earnings in proportion to a refund; a full refund reverses them. Earnings already paid
 * out are flagged for manual recovery instead of being changed.
 */
export async function adjustAuthorEarningsForRefund(order: OrderDoc): Promise<void> {
  const earnings = await AuthorEarning.find({ orderId: order._id, status: { $ne: 'reversed' } });
  const net = Math.max(0, order.amountPaise - (order.refundedPaise ?? 0));
  const now = new Date();
  for (const e of earnings) {
    const recalculated = Math.floor((e.originalAmountPaise * net) / Math.max(1, order.amountPaise));
    if (recalculated >= e.amountPaise) continue;
    if (e.status === 'paid') {
      e.clawbackRequired = true;
      e.history.push({ status: 'paid', at: now, note: `Refund after payout: recover ${e.amountPaise - recalculated} paise` });
    } else if (recalculated === 0) {
      e.status = 'reversed';
      e.history.push({ status: 'reversed', at: now, note: 'Order fully refunded' });
    } else {
      e.history.push({ status: e.status, at: now, note: `Partial refund: adjusted from ${e.amountPaise} to ${recalculated} paise` });
      e.amountPaise = recalculated;
    }
    await e.save();
  }
}

/** Earnings whose refund hold has passed become payable. Runs on reads. */
export async function promotePayableAuthorEarnings(): Promise<number> {
  const now = new Date();
  const res = await AuthorEarning.updateMany(
    { status: 'pending', holdUntil: { $lte: now } },
    { $set: { status: 'payable' }, $push: { history: { status: 'payable', at: now, note: 'Refund hold period ended' } } },
  );
  return res.modifiedCount;
}
