"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, MailCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { emailOnlySchema, loginSchema, type EmailOnlyInput, type Portal } from "@ebook/shared";
import { AuthStatus } from "@/components/auth/auth-status";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { ApiError, api } from "@/lib/api";
import { PORTAL_HOME, PORTAL_LOGIN, safeNext, useLogin } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

const passwordLoginSchema = loginSchema.omit({ portal: true });
type PasswordLoginValues = { email: string; password: string };

export function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const t = useMessages().auth.form;
  const [mode, setMode] = useState<"password" | "magic">("password");
  const next = safeNext(params.get("next"), PORTAL_HOME[portal]);

  const form = useForm<PasswordLoginValues>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const [wrongPortal, setWrongPortal] = useState<{ message: string; portals: Portal[] } | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setWrongPortal(null);
    try {
      await login.mutateAsync({ ...values, portal });
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === "WRONG_PORTAL") {
        setWrongPortal({ message: err.message, portals: (err.details?.portals ?? []) as Portal[] });
        return;
      }
      handleFormError(err, form.setError);
    }
  });

  if (mode === "magic") return <MagicLinkRequest next={next} onBack={() => setMode("password")} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <FormField control={form.control} name="email" label={t.email}>
          {({ field, id, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              className="h-11"
              aria-invalid={invalid}
              {...field}
            />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="password"
          label={
            <span className="flex w-full items-center justify-between gap-2">
              {t.password}
              <Link href="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                {t.forgot}
              </Link>
            </span>
          }
        >
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="current-password" className="h-11" aria-invalid={invalid} {...field} />
          )}
        </FormField>
      </FieldGroup>
      {wrongPortal && (
        <div role="alert" className="border-warning/40 bg-warning/10 space-y-3 rounded-xl border p-3.5 text-sm">
          <p className="flex gap-2">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
            {wrongPortal.message}
          </p>
          {wrongPortal.portals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wrongPortal.portals.map((p) => (
                <Button key={p} asChild size="sm" variant="outline">
                  <Link href={PORTAL_LOGIN[p]}>{t.goToPortal(t.portals[p])}</Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        {t.signIn}
      </Button>
      {portal === "customer" && (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase" aria-hidden>
            <span className="bg-border h-px flex-1" />
            {t.or}
            <span className="bg-border h-px flex-1" />
          </div>
          <Button type="button" variant="outline" size="lg" className="h-11 w-full" onClick={() => setMode("magic")}>
            <Mail aria-hidden />
            {t.magicInstead}
          </Button>
        </>
      )}
    </form>
  );
}

function MagicLinkRequest({ next, onBack }: { next: string; onBack: () => void }) {
  const m = useMessages().auth;
  const t = m.magicLink;
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const request = useMutation({
    mutationFn: (values: EmailOnlyInput) =>
      api("/auth/magic-link", { method: "POST", body: { ...values, redirectTo: next } }),
  });

  if (request.isSuccess) {
    return (
      <AuthStatus
        icon={MailCheck}
        title={t.sentTitle}
        actions={
          <Button variant="outline" onClick={onBack} className="w-full">
            <ArrowLeft aria-hidden />
            {t.backToPassword}
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
      <p className="bg-accent/60 text-accent-foreground flex gap-2.5 rounded-xl p-3.5 text-sm leading-relaxed">
        <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t.intro}
      </p>
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
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft aria-hidden />
        {t.usePassword}
      </Button>
    </form>
  );
}
