import { z } from 'zod';
import { PORTALS } from '../enums';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Enter a valid email address' }).max(254));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')
  .regex(/[a-zA-Z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const nameSchema = z.string().trim().min(2, 'Enter your name').max(80);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
  portal: z.enum(PORTALS).default('customer'),
});
export type LoginInput = z.input<typeof loginSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const tokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  /** Omitted by passwordless (checkout-created) accounts setting their first password. */
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({ name: nameSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
