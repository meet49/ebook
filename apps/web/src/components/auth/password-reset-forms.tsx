"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, LinkIcon, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { emailOnlySchema, passwordSchema, type EmailOnlyInput } from "@ebook/shared";
import { z } from "zod";
import { AuthStatus } from "@/components/auth/auth-status";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { handleFormError } from "@/lib/forms";

export function ForgotPasswordForm() {
  const m = useMessages().auth;
  const t = m.forgotForm;
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const request = useMutation({
    mutationFn: (values: EmailOnlyInput) => api("/auth/forgot-password", { method: "POST", body: values }),
  });

  if (request.isSuccess) {
    return (
      <AuthStatus
        icon={MailCheck}
        title={t.sentTitle}
        actions={
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft aria-hidden />
              {t.backToSignIn}
            </Link>
          </Button>
        }
      >
        {t.sentLead}
        <strong className="text-foreground break-all">{form.getValues("email")}</strong>
        {t.sentTail}
      </AuthStatus>
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={form.handleSubmit((v) => request.mutateAsync(v).catch((err) => handleFormError(err, form.setError)))}
    >
      <FormField control={form.control} name="email" label={m.form.email}>
        {({ field, id, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            placeholder={m.form.emailPlaceholder}
            className="h-11"
            aria-invalid={invalid}
            {...field}
          />
        )}
      </FormField>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        {t.send}
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
  const m = useMessages().auth;
  const t = m.resetForm;
  const form = useForm<ResetFormValues>({ resolver: zodResolver(resetFormSchema), defaultValues: { password: "", confirm: "" } });
  const reset = useMutation({
    mutationFn: (values: ResetFormValues) =>
      api("/auth/reset-password", { method: "POST", body: { token, password: values.password } }),
  });

  if (!token) {
    return (
      <AuthStatus
        tone="destructive"
        icon={LinkIcon}
        title={t.incompleteTitle}
        actions={
          <Button asChild className="w-full">
            <Link href="/forgot-password">{t.requestNew}</Link>
          </Button>
        }
      >
        {t.incomplete}
      </AuthStatus>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthStatus
        tone="success"
        icon={CheckCircle2}
        title={t.successTitle}
        actions={
          <Button asChild className="w-full">
            <Link href="/login">{t.signIn}</Link>
          </Button>
        }
      >
        {t.success}
      </AuthStatus>
    );
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={form.handleSubmit((v) => reset.mutateAsync(v).catch((err) => handleFormError(err, form.setError)))}
    >
      <FieldGroup>
        <FormField control={form.control} name="password" label={m.form.newPassword} description={m.form.passwordHint}>
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="new-password" className="h-11" aria-invalid={invalid} {...field} />
          )}
        </FormField>
        <FormField control={form.control} name="confirm" label={m.form.confirmPassword}>
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="new-password" className="h-11" aria-invalid={invalid} {...field} />
          )}
        </FormField>
      </FieldGroup>
      {reset.isError ? (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3.5 text-sm" role="alert">
          {reset.error.message}{" "}
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            {t.requestNew}
          </Link>
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        {t.submit}
      </Button>
    </form>
  );
}
