import type { RequestHandler } from 'express';
import type { Types } from 'mongoose';
import { getRazorpayCredentials } from '../../lib/payments/config';
import { logger } from '../../lib/logger';
import type { GatewayPayment, GatewayRefund } from '../../lib/payments/gateway';
import { verifyWebhookSignature } from '../../lib/payments/signature';
import { Order } from '../../models/Order';
import { PaymentEvent } from '../../models/PaymentEvent';
import { PaymentMismatchError, applyRefund, assertPaymentMatchesOrder, fulfilOrder, markOrderFailed } from './fulfilment';

interface WebhookBody {
  event: string;
  payload?: {
    payment?: { entity: GatewayPayment };
    refund?: { entity: GatewayRefund };
  };
}

/**
 * Razorpay webhook. Mounted with express.raw() because the signature covers the exact bytes.
 * Every delivery is stored once (unique provider+eventId); redeliveries of an already
 * processed event are acknowledged without side effects, while failed ones are retried.
 */
export const razorpayWebhook: RequestHandler = async (req, res) => {
  const secret = (await getRazorpayCredentials())?.webhookSecret;
  const signature = req.get('x-razorpay-signature');
  const raw = req.body as Buffer;
  if (!secret || !signature || !Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature, secret)) {
    logger.warn({ hasSecret: Boolean(secret) }, 'Rejected webhook with invalid signature');
    res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
    return;
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw.toString('utf8')) as WebhookBody;
  } catch {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON' } });
    return;
  }

  const eventId = req.get('x-razorpay-event-id') ?? `${body.event}:${body.payload?.payment?.entity.id ?? body.payload?.refund?.entity.id ?? 'unknown'}`;
  let event = await PaymentEvent.findOne({ provider: 'razorpay', eventId });
  if (event && (event.status === 'processed' || event.status === 'ignored')) {
    res.json({ ok: true, duplicate: true });
    return;
  }
  if (!event) {
    try {
      event = await PaymentEvent.create({ provider: 'razorpay', eventId, type: body.event, payload: body });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        // A concurrent delivery of the same event is being handled.
        res.json({ ok: true, duplicate: true });
        return;
      }
      throw err;
    }
  }

  try {
    const outcome = await handleEvent(body);
    event.status = outcome.status;
    event.orderId = outcome.orderId ?? null;
    event.error = outcome.note;
    event.processedAt = new Date();
    await event.save();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, eventId, type: body.event }, 'Webhook processing failed');
    event.status = 'failed';
    event.error = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
    await event.save();
    // Non-2xx makes Razorpay retry; the stored event is re-processed on the next delivery.
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Processing failed' } });
  }
};

async function handleEvent(body: WebhookBody): Promise<{ status: 'processed' | 'ignored'; orderId?: Types.ObjectId; note?: string }> {
  switch (body.event) {
    case 'payment.captured':
    case 'order.paid': {
      const payment = body.payload?.payment?.entity;
      if (!payment?.order_id) return { status: 'ignored', note: 'No payment entity' };
      const order = await Order.findOne({ 'razorpay.orderId': payment.order_id });
      if (!order) return { status: 'ignored', note: 'Unknown order' };
      try {
        assertPaymentMatchesOrder(order, payment);
      } catch (err) {
        if (err instanceof PaymentMismatchError) return { status: 'ignored', orderId: order._id, note: err.message };
        throw err;
      }
      await fulfilOrder(order._id, payment, 'webhook');
      return { status: 'processed', orderId: order._id };
    }
    case 'payment.failed': {
      const payment = body.payload?.payment?.entity;
      if (!payment?.order_id) return { status: 'ignored', note: 'No order id' };
      await markOrderFailed(payment.order_id, payment.error_description ?? 'Payment failed');
      return { status: 'processed' };
    }
    case 'refund.processed':
    case 'refund.failed':
    case 'refund.created': {
      const refund = body.payload?.refund?.entity;
      if (!refund?.payment_id) return { status: 'ignored', note: 'No refund entity' };
      const order = await Order.findOne({ 'razorpay.paymentId': refund.payment_id });
      if (!order) return { status: 'ignored', note: 'Unknown payment' };
      await applyRefund(order._id, refund);
      return { status: 'processed', orderId: order._id };
    }
    default:
      return { status: 'ignored', note: 'Unhandled event type' };
  }
}
