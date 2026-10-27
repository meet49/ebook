import type { Types } from 'mongoose';
import type { CommissionType, OrderLine } from '@ebook/shared';
import type { OrderDoc } from '../../models/Order';

export interface StoredLine extends OrderLine {
  productId: Types.ObjectId;
  commissionRule: { type: CommissionType; value: number } | null;
  /** Membership pass length; null for books. */
  membershipDays: number | null;
  /** Marketplace author and their share, snapshotted at order time. */
  authorProfileId: Types.ObjectId | null;
  authorSharePercent: number | null;
}

/** Every book in an order, including orders made before combos (one line from the old fields). */
export function orderLines(order: OrderDoc): StoredLine[] {
  if (order.items?.length) {
    return order.items.map((l) => ({
      productId: l.productId,
      title: l.title ?? '',
      slug: l.slug ?? '',
      listPricePaise: l.listPricePaise,
      pricePaise: l.pricePaise,
      combo: Boolean(l.combo),
      commissionRule: l.commissionRule?.type ? { type: l.commissionRule.type as CommissionType, value: l.commissionRule.value ?? 0 } : null,
      membershipDays: l.membershipDays ?? null,
      authorProfileId: l.authorProfileId ?? null,
      authorSharePercent: l.authorSharePercent ?? null,
    }));
  }
  const rule = order.attribution?.rule?.type
    ? { type: order.attribution.rule.type as CommissionType, value: order.attribution.rule.value ?? 0 }
    : null;
  return [
    {
      productId: order.productId,
      title: order.productSnapshot?.title ?? '',
      slug: order.productSnapshot?.slug ?? '',
      listPricePaise: order.amountPaise,
      pricePaise: order.amountPaise,
      combo: false,
      commissionRule: rule,
      membershipDays: null,
      authorProfileId: null,
      authorSharePercent: null,
    },
  ];
}

export const publicLine = ({ title, slug, listPricePaise, pricePaise, combo }: StoredLine): OrderLine => ({
  title,
  slug,
  listPricePaise,
  pricePaise,
  combo,
});
