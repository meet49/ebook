import { z } from 'zod';
import { COUPON_SCOPES, COUPON_TYPES } from '../enums';

/** Coupon codes are uppercase letters, digits, "-" and "_" (e.g. DIWALI20, LAUNCH-50). */
export const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,19}$/;

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(COUPON_CODE, 'Use 3–20 letters, numbers, "-" or "_"');

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const couponInputSchema = z
  .object({
    code: couponCodeSchema,
    description: z.string().trim().max(200).default(''),
    type: z.enum(COUPON_TYPES),
    /** Whole percent for percent coupons (1–90). */
    percentOff: z.number().int().min(1, 'At least 1%').max(90, 'At most 90%').nullable().default(null),
    /** Paise for fixed coupons. */
    amountOffPaise: z.number().int().min(100, 'At least ₹1').nullable().default(null),
    appliesTo: z.enum(COUPON_SCOPES).default('books'),
    productIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(200).default([]),
    minOrderPaise: z.number().int().min(0).default(0),
    /** Total paid uses allowed; null is unlimited. */
    maxRedemptions: z.number().int().min(1).nullable().default(null),
    /** Paid uses per customer; null is unlimited. */
    perUserLimit: z.number().int().min(1).nullable().default(1),
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean().default(true),
    /** Credit sales made with this coupon to this affiliate (their code), if set. */
    affiliateCode: z.string().trim().toUpperCase().max(20).default(''),
  })
  .superRefine((c, ctx) => {
    if (c.type === 'percent' && c.percentOff == null) ctx.addIssue({ code: 'custom', path: ['percentOff'], message: 'Enter the discount %' });
    if (c.type === 'fixed' && c.amountOffPaise == null) ctx.addIssue({ code: 'custom', path: ['amountOffPaise'], message: 'Enter the discount amount' });
    if (c.appliesTo === 'selected' && c.productIds.length === 0) ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Choose at least one eBook' });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start' });
  });

export type CouponInput = z.input<typeof couponInputSchema>;
export type CouponInputParsed = z.output<typeof couponInputSchema>;
