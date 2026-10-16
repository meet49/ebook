import type { Types } from 'mongoose';
import type { CommissionStatus, CommissionType } from '@ebook/shared';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AffiliateProfile } from '../../models/AffiliateProfile';
import { Commission } from '../../models/Commission';
import type { OrderDoc } from '../../models/Order';
import { Payout } from '../../models/Payout';

/**
 * Commission on the commissionable amount (what was actually captured, after discounts).
 * Percent rules are basis points and round down to the paisa; fixed rules never exceed the sale.
 *   ₹1,000 sale at 20% (2000 bps) → ₹200.
 */
export function calculateCommission(baseAmountPaise: number, rule: { type: CommissionType; value: number }): number {
  if (baseAmountPaise <= 0 || rule.value <= 0) return 0;
  if (rule.type === 'percent') return Math.floor((baseAmountPaise * Math.min(rule.value, 10_000)) / 10_000);
  return Math.min(rule.value, baseAmountPaise);
}

/** Creates the ledger entry for an affiliate-attributed paid order. Safe to call repeatedly. */
export async function createCommissionForOrder(order: OrderDoc): Promise<void> {
  const a = order.attribution;
  if (a?.type !== 'affiliate' || !a.affiliateId || !a.rule?.type) return;

  // The affiliate must still be in good standing when the sale completes.
  const affiliate = await AffiliateProfile.findById(a.affiliateId).select('status');
  if (affiliate?.status !== 'approved') {
    logger.info({ orderId: order._id }, 'Skipping commission: affiliate no longer approved');
    return;
  }

  const rule = { type: a.rule.type as CommissionType, value: a.rule.value ?? 0 };
  const amountPaise = calculateCommission(order.amountPaise, rule);
  if (amountPaise <= 0) return;

  const paidAt = order.paidAt ?? new Date();
  try {
    await Commission.create({
      orderId: order._id,
      affiliateId: a.affiliateId,
      productId: order.productId,
      baseAmountPaise: order.amountPaise,
      rule,
      amountPaise,
      status: 'pending',
      holdUntil: new Date(paidAt.getTime() + env.COMMISSION_HOLD_DAYS * 86_400_000),
      history: [{ status: 'pending', at: paidAt, note: 'Verified sale' }],
    });
  } catch (err) {
    // Unique index on orderId: the commission already exists (duplicate webhook / verify race).
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}

/**
 * Re-bases a commission after a refund. A full refund reverses it; a partial refund
 * recalculates it on the remaining captured amount. Already-paid commissions are flagged
 * for manual clawback instead of being silently changed.
 */
export async function adjustCommissionForRefund(order: OrderDoc, actorId?: Types.ObjectId | null): Promise<void> {
  const commission = await Commission.findOne({ orderId: order._id });
  if (!commission || commission.status === 'reversed') return;

  const net = Math.max(0, order.amountPaise - (order.refundedPaise ?? 0));
  const recalculated = calculateCommission(net, { type: commission.rule!.type as CommissionType, value: commission.rule!.value });

  if (commission.status === 'paid') {
    if (recalculated < commission.amountPaise) {
      commission.clawbackRequired = true;
      commission.history.push({ status: 'paid', at: new Date(), by: actorId ?? null, note: `Refund after payout: recover ${commission.amountPaise - recalculated} paise` });
      await commission.save();
    }
    return;
  }

  if (commission.status === 'processing' && commission.payoutId) {
    // Part of an open payout request: shrink the payout by the same amount so the admin never
    // transfers money for a refunded sale. If the payout was settled meanwhile, flag a clawback.
    const delta = commission.amountPaise - recalculated;
    if (delta <= 0) return;
    const reversed = recalculated === 0;
    const payoutUpdate = await Payout.updateOne(
      { _id: commission.payoutId, status: { $in: ['requested', 'processing'] } },
      { $inc: { amountPaise: -delta }, ...(reversed ? { $pull: { commissionIds: commission._id } } : {}) },
    );
    if (payoutUpdate.modifiedCount === 1) {
      await Commission.updateOne(
        { _id: commission._id },
        {
          $set: reversed ? { status: 'reversed', payoutId: null } : { amountPaise: recalculated, baseAmountPaise: net },
          $push: { history: { status: reversed ? 'reversed' : 'processing', at: new Date(), by: actorId ?? null, note: reversed ? 'Order fully refunded — removed from payout' : `Partial refund: commission and payout reduced by ${delta} paise` } },
        },
      );
    } else {
      await Commission.updateOne(
        { _id: commission._id },
        { $set: { clawbackRequired: true }, $push: { history: { status: 'processing', at: new Date(), by: actorId ?? null, note: `Refund after payout settled: recover ${delta} paise` } } },
      );
    }
    return;
  }

  if (net === 0 || recalculated === 0) {
    await transitionCommission(commission._id, ['pending', 'approved', 'payable'], 'reversed', 'Order fully refunded', actorId);
    return;
  }

  if (recalculated !== commission.amountPaise) {
    commission.history.push({
      status: commission.status as CommissionStatus,
      at: new Date(),
      by: actorId ?? null,
      note: `Partial refund: commission adjusted from ${commission.amountPaise} to ${recalculated} paise`,
    });
    commission.amountPaise = recalculated;
    commission.baseAmountPaise = net;
    await commission.save();
  }
}

/** Atomic status change with an audit trail entry; returns false if the commission was not in an allowed state. */
export async function transitionCommission(
  id: Types.ObjectId,
  from: CommissionStatus[],
  to: CommissionStatus,
  note: string,
  actorId?: Types.ObjectId | null,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const res = await Commission.updateOne(
    { _id: id, status: { $in: from } },
    { $set: { status: to, ...extra }, $push: { history: { status: to, at: new Date(), by: actorId ?? null, note } } },
  );
  return res.modifiedCount === 1;
}

/** Approved commissions whose refund hold has passed become payable. Runs on reads and on a timer. */
export async function promotePayableCommissions(): Promise<number> {
  const now = new Date();
  const res = await Commission.updateMany(
    { status: 'approved', holdUntil: { $lte: now } },
    { $set: { status: 'payable' }, $push: { history: { status: 'payable', at: now, by: null, note: 'Refund hold period ended' } } },
  );
  return res.modifiedCount;
}
