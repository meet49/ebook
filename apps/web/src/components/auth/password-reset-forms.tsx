"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { emailOnlySchema, passwordSchema, type EmailOnlyInput } from "@ebook/shared";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { handleFormError } from "@/lib/forms";

export function ForgotPasswordForm() {
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const request = useMutation({
    mutationFn: (values: EmailOnlyInput) => api("/auth/forgot-password", { method: "POST", body: values }),
  });

  if (request.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="text-primary mx-auto size-10" aria-hidden />
        <p className="text-sm">
          If an account exists for <strong>{form.getValues("email")}</strong>, we&apos;ve sent a link to reset your
          password. It expires in 1 hour.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={form.handleSubmit((v) => request.mutateAsync(v).catch((err) => handleFormError(err, form.setError)))}
    >
      <FormField control={form.control} name="email" label="Email">
        {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Send reset link
      </Button>
    </form>
  );
}

const resetFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type ResetFormValues = z.infer<typeof resetFormSchema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const form = useForm<ResetFormValues>({ resolver: zodResolver(resetFormSchema), defaultValues: { password: "", confirm: "" } });
  const reset = useMutation({
    mutationFn: (values: ResetFormValues) =>
      api("/auth/reset-password", { method: "POST", body: { token, password: values.password } }),
  });

  if (!token) {
    return (
      <div className="space-y-4 text-center text-sm">
        <p>This reset link is incomplete. Please request a new one.</p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (reset.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <p className="text-sm">Your password has been updated and you&apos;ve been signed out of other devices.</p>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={form.handleSubmit((v) => reset.mutateAsync(v).catch((err) => handleFormError(err, form.setError)))}
    >
      <FieldGroup>
        <FormField control={form.control} name="password" label="New password" description="At least 8 characters, with a letter and a number.">
          {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField control={form.control} name="confirm" label="Confirm new password">
          {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
        </FormField>
      </FieldGroup>
      {reset.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {reset.error.message}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Update password
      </Button>
    </form>
  );
}
