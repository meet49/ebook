import type { OrderStatus } from "@ebook/shared";

export interface CustomerOrder {
  orderNumber: string;
  status: OrderStatus;
  product: { title: string; slug: string };
  amountPaise: number;
  refundedPaise: number;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrder extends CustomerOrder {
  id: string;
  productId: string;
  customer: { id: string; name: string; email: string };
  razorpay: { orderId: string; paymentId: string | null; method: string | null };
  attribution: { type: "affiliate" | "direct"; affiliateCode: string | null };
  refunds: { refundId: string; amountPaise: number; status: string; createdAt: string | null }[];
  failureReason: string | null;
}
