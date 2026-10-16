import { createHmac, randomBytes } from 'node:crypto';
import type { GatewayOrder, GatewayPayment, GatewayRefund, PaymentGateway } from '../src/lib/payments/gateway';

const id = (prefix: string) => `${prefix}_${randomBytes(7).toString('hex')}`;

/**
 * In-memory stand-in for the Razorpay API, used only by tests. It never runs in the app:
 * production always talks to Razorpay. Tests drive it to simulate what a customer does in
 * Razorpay Checkout (e.g. a captured payment), then exercise our real verification code.
 */
export class FakeGateway implements PaymentGateway {
  readonly keyId = 'rzp_test_unit';
  orders = new Map<string, GatewayOrder>();
  payments = new Map<string, GatewayPayment>();
  refunds: GatewayRefund[] = [];

  async createOrder(input: { amount: number; currency: string }) {
    const order = { id: id('order'), amount: input.amount, currency: input.currency, status: 'created' };
    this.orders.set(order.id, order);
    return order;
  }

  /** Simulates the customer completing payment in Razorpay Checkout. */
  pay(orderId: string, overrides: Partial<GatewayPayment> = {}): GatewayPayment {
    const order = this.orders.get(orderId)!;
    const payment: GatewayPayment = {
      id: id('pay'),
      order_id: orderId,
      amount: order.amount,
      currency: order.currency,
      status: 'captured',
      method: 'upi',
      ...overrides,
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async fetchPayment(paymentId: string) {
    const p = this.payments.get(paymentId);
    if (!p) throw new Error('not found');
    return p;
  }

  async capturePayment(paymentId: string) {
    const p = this.payments.get(paymentId)!;
    p.status = 'captured';
    return p;
  }

  async listOrderPayments(orderId: string) {
    return [...this.payments.values()].filter((p) => p.order_id === orderId);
  }

  async refund(paymentId: string, amount: number) {
    const refund = { id: id('rfnd'), payment_id: paymentId, amount, status: 'processed' };
    this.refunds.push(refund);
    return refund;
  }
}

export const checkoutSignature = (orderId: string, paymentId: string) =>
  createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest('hex');

export const webhookSignature = (body: string) =>
  createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex');
