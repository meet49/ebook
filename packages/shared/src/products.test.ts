import { describe, expect, it } from 'vitest';
import { productInputSchema, slugify } from './schemas/products';

const base = { title: 'Deep Work', pricePaise: 49_900 };

describe('slugify', () => {
  it('produces URL-safe slugs', () => {
    expect(slugify('The Art of Focus!')).toBe('the-art-of-focus');
    expect(slugify('  Café & Crème — 2nd Ed.  ')).toBe('cafe-creme-2nd-ed');
    expect(slugify('***')).toBe('');
  });
});

describe('productInputSchema', () => {
  it('applies defaults', () => {
    const p = productInputSchema.parse(base);
    expect(p.affiliate).toEqual({ enabled: true, type: 'percent', value: 2000 });
    expect(p.salePricePaise).toBeNull();
  });

  it('rejects invalid pricing and commission', () => {
    expect(productInputSchema.safeParse({ ...base, pricePaise: 50 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, pricePaise: 999.5 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, salePricePaise: 49_900 }).success).toBe(false);
    expect(
      productInputSchema.safeParse({ ...base, affiliate: { enabled: true, type: 'percent', value: 10_001 } }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ ...base, salePricePaise: 29_900, affiliate: { enabled: true, type: 'fixed', value: 30_000 } })
        .success,
    ).toBe(false);
  });

  it('rejects malformed slugs', () => {
    expect(productInputSchema.safeParse({ ...base, slug: 'Bad Slug' }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, slug: 'good-slug-2' }).success).toBe(true);
  });
});
