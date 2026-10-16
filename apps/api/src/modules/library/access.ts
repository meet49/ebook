import type { Types } from 'mongoose';
import { forbidden, notFound } from '../../lib/errors';
import { Entitlement } from '../../models/Entitlement';
import { Order } from '../../models/Order';
import { Product, type ProductDoc } from '../../models/Product';

/**
 * The single gate for reading content: the user must hold an active entitlement.
 * Archived or unpublished books stay readable for people who bought them.
 */
export async function requireEntitlement(userId: Types.ObjectId, product: ProductDoc) {
  const entitlement = await Entitlement.findOne({ userId, productId: product._id, status: 'active' });
  if (!entitlement) throw forbidden('You do not own this eBook');
  return entitlement;
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
