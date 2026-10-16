import { z } from 'zod';
import { emailSchema, nameSchema, passwordSchema } from './auth';

export const AFFILIATE_CHANNELS = ['YouTube', 'Instagram', 'Blog / website', 'Facebook', 'X (Twitter)', 'Telegram', 'WhatsApp', 'Email newsletter', 'Other'] as const;
export const AUDIENCE_SIZES = ['Under 1,000', '1,000 – 10,000', '10,000 – 100,000', 'Over 100,000'] as const;

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), 'Enter a full URL starting with https://');

export const affiliateApplicationSchema = z.object({
  website: optionalUrl.default(''),
  channels: z.array(z.enum(AFFILIATE_CHANNELS)).min(1, 'Choose at least one channel').max(9),
  audienceSize: z.enum(AUDIENCE_SIZES),
  promotionPlan: z.string().trim().min(30, 'Tell us a little more (at least 30 characters)').max(2000),
  acceptTerms: z.literal(true, { message: 'You must accept the affiliate terms' }),
});
export type AffiliateApplicationInput = z.input<typeof affiliateApplicationSchema>;

/** Visitors without an account create one as part of applying. */
export const affiliateSignupSchema = affiliateApplicationSchema.extend({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type AffiliateSignupInput = z.input<typeof affiliateSignupSchema>;

export const payoutDetailsSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('upi'),
    upiId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/, 'Enter a valid UPI ID, e.g. name@okbank'),
  }),
  z.object({
    method: z.literal('bank_transfer'),
    accountName: z.string().trim().min(2, 'Enter the account holder name').max(100),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Enter 9–18 digits'),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code, e.g. HDFC0001234'),
  }),
]);
export type PayoutDetailsInput = z.input<typeof payoutDetailsSchema>;
