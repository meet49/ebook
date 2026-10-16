import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Commission } from '../src/models/Commission';
import { Entitlement } from '../src/models/Entitlement';
import { PaymentEvent } from '../src/models/PaymentEvent';
import { Product, effectivePricePaise } from '../src/models/Product';

const productBase = { title: 'The First Book', pricePaise: 100_000 };

describe('Product', () => {
  it('enforces unique slugs', async () => {
    await Product.create({ ...productBase, slug: 'first-book' });
    await expect(Product.create({ ...productBase, slug: 'First-Book' })).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects fractional paise and sale prices above the regular price', async () => {
    await expect(Product.create({ ...productBase, slug: 'a', pricePaise: 999.5 })).rejects.toThrow(/paise/);
    await expect(Product.create({ ...productBase, slug: 'b', salePricePaise: 100_000 })).rejects.toThrow(/lower/);
    await expect(
      Product.create({ ...productBase, slug: 'c', affiliate: { enabled: true, type: 'percent', value: 10_001 } }),
    ).rejects.toThrow(/100%/);
  });

  it('charges the sale price when one is set', () => {
    expect(effectivePricePaise({ pricePaise: 100_000, salePricePaise: null })).toBe(100_000);
    expect(effectivePricePaise({ pricePaise: 100_000, salePricePaise: 79_900 })).toBe(79_900);
  });
});

describe('idempotency indexes', () => {
  it('stores each provider payment event once', async () => {
    const evt = { provider: 'razorpay', eventId: 'evt_1', type: 'payment.captured', payload: {} };
    await PaymentEvent.create(evt);
    await expect(PaymentEvent.create(evt)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows at most one commission per order', async () => {
    const doc = {
      orderId: new Types.ObjectId(),
      affiliateId: new Types.ObjectId(),
      productId: new Types.ObjectId(),
      baseAmountPaise: 100_000,
      rule: { type: 'percent' as const, value: 2000 },
      amountPaise: 20_000,
      holdUntil: new Date(),
    };
    await Commission.create(doc);
    await expect(Commission.create(doc)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows one entitlement per user and product', async () => {
    const doc = { userId: new Types.ObjectId(), productId: new Types.ObjectId() };
    await Entitlement.create(doc);
    await expect(Entitlement.create(doc)).rejects.toMatchObject({ code: 11000 });
  });
});
