import type { Types } from 'mongoose';
import { forbidden, notFound } from '../../lib/errors';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product, type ProductDoc } from '../../models/Product';
import { currentMembership } from '../membership/passes';

/** Fields the access check reads; select them when loading a product for it. */
export const ACCESS_FIELDS = 'kind status includedInMembership';

/** A published book that members can read. */
export const isMemberBook = (p: Pick<ProductDoc, 'kind' | 'status' | 'includedInMembership'>) =>
  p.kind !== 'membership' && p.status === 'published' && p.includedInMembership !== false;

/**
 * The single gate for reading content: the user must have bought the book, or have a running
 * membership while the book is published and part of it. Bought books stay readable after they
 * are archived or unpublished; membership books do not. Returns the order behind the access,
 * whose number goes into the watermark.
 */
export async function requireReadAccess(userId: Types.ObjectId, product: ProductDoc): Promise<{ orderId: Types.ObjectId | null }> {
  const entitlement = await Entitlement.findOne({ userId, productId: product._id, status: 'active' });
  if (entitlement) return { orderId: entitlement.orderId ?? null };
  if (isMemberBook(product)) {
    const membership = await currentMembership(userId);
    if (membership) return { orderId: membership.orderId };
  }
  throw forbidden('You do not own this eBook');
}

export async function findReadableProductBySlug(slug: string): Promise<ProductDoc> {
  const product = await Product.findOne({ slug: slug.toLowerCase() });
  if (!product || !product.pageSetId) throw notFound('eBook not found');
  return product;
}

export async function orderNumberFor(orderId: Types.ObjectId | null | undefined): Promise<string | null> {
  if (!orderId) return null;
  return (await Order.findById(orderId).select('orderNumber'))?.orderNumber ?? null;
}
