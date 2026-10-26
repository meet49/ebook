import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFxProvider } from '../src/lib/fx';
import { setGateway } from '../src/lib/payments/gateway';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { Setting } from '../src/models/Setting';
import { FakeGateway } from './fake-gateway';
import { agent, createUser } from './helpers';

let gw: FakeGateway;
const RATE = 84;

beforeEach(async () => {
  gw = new FakeGateway();
  setGateway(gw);
  setFxProvider(async () => RATE);
  const base = { description: 'x', status: 'published' as const, publishedAt: new Date(), categories: ['Productivity'] };
  await Product.create([
    { ...base, slug: 'focus-basics', title: 'Focus Basics', pricePaise: 19_900, intlPriceCents: 900 },
    // No international combo price set: the INR combo discount (99/149) is applied to $6.
    { ...base, slug: 'focus-advanced', title: 'Focus Advanced', pricePaise: 14_900, comboPricePaise: 9_900, intlPriceCents: 600 },
    { ...base, slug: 'india-only', title: 'India Only', pricePaise: 9_900 },
  ]);
});

afterEach(() => setFxProvider(null));
afterAll(() => setGateway(null));

const fromUS = () => agent().set('Cookie', 'rns_country=US');
const quote = (a: ReturnType<typeof agent>, body: Record<string, unknown>) => a.post('/api/v1/checkout/quote').send(body);
const guest = { name: 'Guest Buyer', email: 'guest@example.com' };

describe('international prices', () => {
  it('shows the USD price abroad and charges it in INR at the day’s rate', async () => {
    const res = await quote(fromUS(), { productSlug: 'focus-basics' }).expect(200);
    expect(res.body.quote).toMatchObject({ currency: 'USD', totalDisplayMinor: 900, totalPaise: 75_600, fxRate: RATE });

    const order = await fromUS().post('/api/v1/checkout/orders').send({ productSlug: 'focus-basics', ...guest }).expect(201);
    expect(order.body.amountPaise).toBe(75_600);
    expect(gw.orders.get(order.body.razorpayOrderId)!).toMatchObject({ amount: 75_600, currency: 'INR' });
    expect(order.body.display).toEqual({ currency: 'USD', totalMinor: 900, fxRate: RATE });
    const saved = await Order.findOne({ orderNumber: order.body.orderNumber });
    expect(saved!.display).toMatchObject({ currency: 'USD', totalMinor: 900, fxRate: RATE });
    expect(saved!.items[0]!.displayPriceMinor).toBe(900);
  });

  it('keeps INR for visitors in India', async () => {
    const res = await quote(agent(), { productSlug: 'focus-basics' }).expect(200);
    expect(res.body.quote).toMatchObject({ currency: 'INR', totalDisplayMinor: 19_900, totalPaise: 19_900, fxRate: null });

    // Vercel's country header wins over the cookie.
    const fromIndia = agent().set('Cookie', 'rns_country=US').set('x-vercel-ip-country', 'IN');
    expect((await quote(fromIndia, { productSlug: 'focus-basics' })).body.quote.currency).toBe('INR');
    const viaHeader = agent().set('x-vercel-ip-country', 'US');
    expect((await quote(viaHeader, { productSlug: 'focus-basics' })).body.quote.currency).toBe('USD');
  });

  it('prices a combo in USD, deriving the international combo price when none is set', async () => {
    const res = await quote(fromUS(), { productSlug: 'focus-basics', addOnSlugs: ['focus-advanced'] }).expect(200);
    const q = res.body.quote;
    // $6 × 99/149 = $3.99; charged ₹335 at 84.
    expect(q.lines.map((l: { displayPriceMinor: number; pricePaise: number }) => [l.displayPriceMinor, l.pricePaise])).toEqual([
      [900, 75_600],
      [399, 33_500],
    ]);
    expect(q).toMatchObject({ currency: 'USD', totalDisplayMinor: 1_299, totalPaise: 109_100, savingsDisplayMinor: 201 });
  });

  it('falls back to INR when a book has no international price', async () => {
    const res = await quote(fromUS(), { productSlug: 'india-only' }).expect(200);
    expect(res.body.quote).toMatchObject({ currency: 'INR', totalDisplayMinor: 9_900, totalPaise: 9_900 });
  });

  it('uses the last stored rate when the feed fails, and INR when there is no rate at all', async () => {
    setFxProvider(async () => {
      throw new Error('feed down');
    });
    expect((await quote(fromUS(), { productSlug: 'focus-basics' })).body.quote.currency).toBe('INR');

    await Setting.create({ key: 'fx.usd_inr', value: { rate: 80, fetchedAt: new Date() } });
    setFxProvider(async () => {
      throw new Error('still down');
    });
    const res = await quote(fromUS(), { productSlug: 'focus-basics' }).expect(200);
    expect(res.body.quote).toMatchObject({ currency: 'USD', totalPaise: 72_000, fxRate: 80 });
  });

  it('rejects an international combo price that is not lower than the international price', async () => {
    await createUser({ email: 'boss@example.com', password: 'pass-word-1', roles: ['admin'] });
    const admin = agent();
    await admin.post('/api/v1/auth/login').send({ email: 'boss@example.com', password: 'pass-word-1', portal: 'admin' }).expect(200);
    const res = await admin.post('/api/v1/admin/products').send({ title: 'Intl Test', pricePaise: 9_900, intlPriceCents: 500, intlComboPriceCents: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.intlComboPriceCents).toBeDefined();
  });
});
