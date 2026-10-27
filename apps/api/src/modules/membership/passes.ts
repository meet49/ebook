import type { Types } from 'mongoose';
import { MembershipPass } from '../../models/MembershipPass';
import type { OrderDoc } from '../../models/Order';
import { orderLines } from '../checkout/lines';

const DAY_MS = 86_400_000;

export interface ActiveMembership {
  /** When the last stacked pass ends. */
  endsAt: Date;
  /** The order of the pass running now (its number goes into the watermark). */
  orderId: Types.ObjectId;
}

/** The buyer's running membership, if any. Passes run back to back in the order they were bought. */
export async function currentMembership(userId: Types.ObjectId, now = new Date()): Promise<ActiveMembership | null> {
  const passes = await MembershipPass.find({ userId, status: 'active' }).sort({ grantedAt: 1, _id: 1 });
  let end = 0;
  let current: Types.ObjectId | null = null;
  for (const p of passes) {
    const start = Math.max(p.grantedAt.getTime(), end);
    end = start + p.days * DAY_MS;
    if (!current && start <= now.getTime() && now.getTime() < end) current = p.orderId;
  }
  return current && end > now.getTime() ? { endsAt: new Date(end), orderId: current } : null;
}

/** Grants the passes in a paid order. Idempotent, like the rest of fulfilment. */
export async function grantPasses(order: OrderDoc, now: Date): Promise<void> {
  for (const line of orderLines(order)) {
    if (!line.membershipDays) continue;
    await MembershipPass.updateOne(
      { orderId: order._id, productId: line.productId },
      {
        $set: { status: 'active', revokedAt: null },
        $setOnInsert: { userId: order.userId, days: line.membershipDays, grantedAt: order.paidAt ?? now },
      },
      { upsert: true },
    );
  }
}

export async function revokePasses(orderId: Types.ObjectId): Promise<void> {
  await MembershipPass.updateMany({ orderId, status: 'active' }, { $set: { status: 'revoked', revokedAt: new Date() } });
}

/** How many buyers have a running membership now (stacked passes count once). */
export async function countMembers(now = new Date()): Promise<number> {
  const passes = await MembershipPass.find({ status: 'active' }).select('userId days grantedAt').sort({ grantedAt: 1, _id: 1 }).lean();
  const endBy = new Map<string, number>();
  for (const p of passes) {
    const key = p.userId.toString();
    const start = Math.max(p.grantedAt.getTime(), endBy.get(key) ?? 0);
    endBy.set(key, start + p.days * DAY_MS);
  }
  return [...endBy.values()].filter((end) => end > now.getTime()).length;
}
