import type { OrderLine, OrderStatus } from "@ebook/shared";

export interface CustomerOrder {
  orderNumber: string;
  status: OrderStatus;
  product: { title: string; slug: string };
  /** Every book in the order (one for single-book orders). */
  lines: OrderLine[];
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

/** "Book A + Book B" for combo orders, the title for single-book orders. */
export function orderTitle(o: Pick<CustomerOrder, "product" | "lines">): string {
  return o.lines?.length ? o.lines.map((l) => l.title).join(" + ") : o.product.title;
}

/** Where "Read" goes: the book itself, or the library when the order has several books. */
export function orderReadHref(o: Pick<CustomerOrder, "product" | "lines">): string {
  return (o.lines?.length ?? 1) > 1 ? "/library" : `/read/${o.product.slug}`;
}
