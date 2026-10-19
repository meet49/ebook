import { z } from 'zod';
import { COMMISSION_TYPES, PRODUCT_STATUSES } from '../enums';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "The Art of Focus!" -> "the-art-of-focus" */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Razorpay's minimum charge is ₹1; the ceiling guards against typos (₹1,00,000). */
export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 10_000_000;

const paise = z.number().int('Amount must be in whole paise').min(0);

const shortText = (max: number) => z.string().trim().max(max);

export const productInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a title').max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens')
      .optional(),
    subtitle: shortText(240).default(''),
    author: shortText(120).default(''),
    description: z.string().max(20_000).default(''),
    benefits: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
    categories: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
    language: shortText(40).default('English'),
    pricePaise: paise
      .min(MIN_PRICE_PAISE, 'Price must be at least ₹1')
      .max(MAX_PRICE_PAISE, 'Price must be at most ₹1,00,000'),
    salePricePaise: paise.min(MIN_PRICE_PAISE, 'Sale price must be at least ₹1').nullable().default(null),
    /**
     * Price when bought together with another book from the same category, or within the
     * post-purchase offer window. Null means the book is never offered as a combo.
     */
    comboPricePaise: paise.min(MIN_PRICE_PAISE, 'Combo price must be at least ₹1').nullable().default(null),
    featured: z.boolean().default(false),
    affiliate: z
      .object({
        enabled: z.boolean(),
        type: z.enum(COMMISSION_TYPES),
        /** Basis points for percent (2000 = 20%), paise for fixed. */
        value: paise,
      })
      .default({ enabled: true, type: 'percent', value: 2000 }),
    previewPages: z.array(z.number().int().min(1)).max(10).default([]),
    toc: z
      .array(z.object({ title: z.string().trim().min(1).max(200), page: z.number().int().min(1) }))
      .max(300)
      .default([]),
  })
  .superRefine((p, ctx) => {
    if (p.salePricePaise != null && p.salePricePaise >= p.pricePaise) {
      ctx.addIssue({ code: 'custom', path: ['salePricePaise'], message: 'Sale price must be lower than the regular price' });
    }
    if (p.affiliate.type === 'percent' && p.affiliate.value > 10_000) {
      ctx.addIssue({ code: 'custom', path: ['affiliate', 'value'], message: 'Commission cannot exceed 100%' });
    }
    const charged = p.salePricePaise ?? p.pricePaise;
    if (p.comboPricePaise != null && p.comboPricePaise >= charged) {
      ctx.addIssue({ code: 'custom', path: ['comboPricePaise'], message: 'Combo price must be lower than the selling price' });
    }
    if (p.affiliate.type === 'fixed' && p.affiliate.value > charged) {
      ctx.addIssue({ code: 'custom', path: ['affiliate', 'value'], message: 'Commission cannot exceed the selling price' });
    }
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductInputParsed = z.output<typeof productInputSchema>;

export const PRODUCT_SORTS = ['featured', 'newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(40).optional(),
  sort: z.enum(PRODUCT_SORTS).default('featured'),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type CatalogQuery = z.input<typeof catalogQuerySchema>;

export const adminProductQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
