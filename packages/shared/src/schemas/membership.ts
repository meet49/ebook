import { z } from 'zod';
import { COMMISSION_TYPES } from '../enums';
import { MAX_PRICE_PAISE, MIN_PRICE_PAISE } from './products';

const paise = z.number().int('Amount must be in whole paise').min(0);

/** A membership plan: a pass that opens every included eBook for a number of days. */
export const membershipPlanInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a name').max(160),
    description: z.string().trim().max(2_000).default(''),
    benefits: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
    durationDays: z.number().int().min(1, 'At least 1 day').max(3_650, 'At most 10 years'),
    pricePaise: paise.min(MIN_PRICE_PAISE, 'Price must be at least ₹1').max(MAX_PRICE_PAISE, 'Price must be at most ₹1,00,000'),
    salePricePaise: paise.min(MIN_PRICE_PAISE, 'Sale price must be at least ₹1').nullable().default(null),
    intlPriceCents: paise.min(100, 'International price must be at least $1').max(100_000, 'International price must be at most $1,000').nullable().default(null),
    /** Highlighted as the best value on the membership page. */
    featured: z.boolean().default(false),
    affiliate: z
      .object({ enabled: z.boolean(), type: z.enum(COMMISSION_TYPES), value: paise })
      .default({ enabled: true, type: 'percent', value: 2000 }),
  })
  .superRefine((p, ctx) => {
    if (p.salePricePaise != null && p.salePricePaise >= p.pricePaise) {
      ctx.addIssue({ code: 'custom', path: ['salePricePaise'], message: 'Sale price must be lower than the regular price' });
    }
    if (p.affiliate.type === 'percent' && p.affiliate.value > 10_000) {
      ctx.addIssue({ code: 'custom', path: ['affiliate', 'value'], message: 'Commission cannot exceed 100%' });
    }
  });

export type MembershipPlanInput = z.input<typeof membershipPlanInputSchema>;
export type MembershipPlanInputParsed = z.output<typeof membershipPlanInputSchema>;
