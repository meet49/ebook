import { z } from 'zod';
import { emailSchema, nameSchema, passwordSchema } from './auth';

/** The author's share of a sale when an admin approves them, unless they set another. */
export const DEFAULT_AUTHOR_SHARE_PERCENT = 70;

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), 'Enter a full URL starting with https://');

export const authorProfileInputSchema = z.object({
  /** Shown as the author on the author's books. */
  penName: z.string().trim().min(2, 'Enter your pen name').max(80),
  bio: z.string().trim().max(1_000).default(''),
  website: optionalUrl.default(''),
});
export type AuthorProfileInput = z.input<typeof authorProfileInputSchema>;

export const authorApplicationSchema = authorProfileInputSchema.extend({
  /** What they write and want to publish. */
  aboutBooks: z.string().trim().min(30, 'Tell us a little more (at least 30 characters)').max(2_000),
  acceptTerms: z.literal(true, { message: 'You must accept the author terms' }),
});
export type AuthorApplicationInput = z.input<typeof authorApplicationSchema>;

/** Visitors without an account create one as part of applying. */
export const authorSignupSchema = authorApplicationSchema.extend({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type AuthorSignupInput = z.input<typeof authorSignupSchema>;

/** Admin approval sets the author's share of each sale (after any affiliate commission). */
export const authorApprovalSchema = z.object({
  sharePercent: z.number().int().min(1, 'At least 1%').max(95, 'At most 95%').default(DEFAULT_AUTHOR_SHARE_PERCENT),
  note: z.string().trim().max(1_000).default(''),
});

export const authorReviewNoteSchema = z.object({
  note: z.string().trim().min(3, 'Add a short note for the author').max(1_000),
});

export const authorPayoutSchema = z.object({
  reference: z.string().trim().min(4, 'Enter the transaction reference').max(100),
  note: z.string().trim().max(500).default(''),
});
