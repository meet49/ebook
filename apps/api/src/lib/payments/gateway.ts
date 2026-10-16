import { HttpError } from '../errors';
import { logger } from '../logger';
import { getRazorpayCredentials, modeOf } from './config';

export interface GatewayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface GatewayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  email?: string;
  error_description?: string | null;
}

export interface GatewayRefund {
  id: string;
  payment_id: string;
  amount: number;
  /** pending | processed | failed */
  status: string;
}

/** The subset of the Razorpay API this platform uses. Swappable in tests. */
export interface PaymentGateway {
  readonly keyId: string;
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<GatewayOrder>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capturePayment(paymentId: string, amount: number, currency: string): Promise<GatewayPayment>;
  listOrderPayments(orderId: string): Promise<GatewayPayment[]>;
  refund(paymentId: string, amount: number, notes: Record<string, string>): Promise<GatewayRefund>;
}

const notConfigured = () =>
  new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Payments are not configured yet. Please try again later.');

/** Razorpay REST API (https://razorpay.com/docs/api/). Test vs live mode is determined by the key pair. */
class RazorpayGateway implements PaymentGateway {
  private readonly auth: string;

  constructor(
    readonly keyId: string,
    keySecret: string,
  ) {
    this.auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`https://api.razorpay.com/v1${path}`, {
        method,
        headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.error({ err, path }, 'Razorpay request failed');
      throw new HttpError(502, 'GATEWAY_UNAVAILABLE', 'The payment provider is unreachable. Please try again.');
    }
    const data = (await res.json().catch(() => null)) as { error?: { description?: string; code?: string } } | null;
    if (!res.ok) {
      logger.warn({ status: res.status, path, error: data?.error }, 'Razorpay API error');
      throw new HttpError(502, 'GATEWAY_ERROR', data?.error?.description ?? 'The payment provider returned an error.');
    }
    return data as T;
  }

  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
    return this.call<GatewayOrder>('POST', '/orders', input);
  }
  fetchPayment(paymentId: string) {
    return this.call<GatewayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
  }
  capturePayment(paymentId: string, amount: number, currency: string) {
    return this.call<GatewayPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });
  }
  async listOrderPayments(orderId: string) {
    return (await this.call<{ items: GatewayPayment[] }>('GET', `/orders/${encodeURIComponent(orderId)}/payments`)).items;
  }
  refund(paymentId: string, amount: number, notes: Record<string, string>) {
    return this.call<GatewayRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, notes, speed: 'normal' });
  }
}

let override: PaymentGateway | null = null;
let cached: { keyId: string; keySecret: string; gateway: PaymentGateway } | null = null;

/**
 * The gateway for the currently effective credentials (Admin → Settings, else environment).
 * Throws 503 PAYMENTS_NOT_CONFIGURED when no keys are set.
 */
export async function getGateway(): Promise<PaymentGateway> {
  if (override) return override;
  const creds = await getRazorpayCredentials();
  if (!creds) throw notConfigured();
  if (!cached || cached.keyId !== creds.keyId || cached.keySecret !== creds.keySecret) {
    cached = { keyId: creds.keyId, keySecret: creds.keySecret, gateway: new RazorpayGateway(creds.keyId, creds.keySecret) };
  }
  return cached.gateway;
}

/** Test hook only. */
export function setGateway(next: PaymentGateway | null): void {
  override = next;
}

export async function paymentsMode(): Promise<'test' | 'live' | 'unconfigured'> {
  return modeOf((await getRazorpayCredentials())?.keyId);
}
