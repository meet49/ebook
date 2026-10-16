import type { OrderDoc } from '../../models/Order';

export function toCustomerOrder(o: OrderDoc) {
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    product: { title: o.productSnapshot?.title ?? '', slug: o.productSnapshot?.slug ?? '' },
    amountPaise: o.amountPaise,
    refundedPaise: o.refundedPaise ?? 0,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
  };
}

export function toAdminOrder(o: OrderDoc, affiliateCode?: string | null) {
  return {
    id: o._id.toString(),
    ...toCustomerOrder(o),
    productId: o.productId.toString(),
    customer: { id: o.userId.toString(), name: o.customerSnapshot?.name ?? '', email: o.customerSnapshot?.email ?? '' },
    razorpay: { orderId: o.razorpay?.orderId ?? '', paymentId: o.razorpay?.paymentId ?? null, method: o.razorpay?.method ?? null },
    attribution: { type: o.attribution?.type ?? 'direct', affiliateCode: affiliateCode ?? null },
    refunds: o.refunds.map((r) => ({
      refundId: r.refundId ?? '',
      amountPaise: r.amountPaise ?? 0,
      status: r.status ?? '',
      createdAt: r.createdAt?.toISOString() ?? null,
    })),
    failureReason: o.failureReason ?? null,
  };
}
