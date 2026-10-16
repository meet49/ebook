import { hmacSha256Hex, safeEqual } from '../crypto';

/** Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  return safeEqual(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret). Must use the exact raw bytes. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string): boolean {
  return safeEqual(hmacSha256Hex(webhookSecret, rawBody), signature);
}
