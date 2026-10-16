"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { emailOnlySchema, loginSchema, type EmailOnlyInput, type Portal } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, api } from "@/lib/api";
import { PORTAL_HOME, PORTAL_LOGIN, safeNext, useLogin } from "@/lib/auth";

const PORTAL_NAME: Record<Portal, string> = { customer: "reader", affiliate: "affiliate", admin: "admin" };
import { handleFormError } from "@/lib/forms";

const passwordLoginSchema = loginSchema.omit({ portal: true });
type PasswordLoginValues = { email: string; password: string };

export function LoginForm({ portal }: { portal: Portal }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
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
        <FormField control={form.control} name="email" label="Email">
          {({ field, id, invalid }) => (
            <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="password"
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-primary text-xs font-normal hover:underline">
                Forgot password?
              </Link>
            </span>
          }
        >
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="current-password" aria-invalid={invalid} {...field} />
          )}
        </FormField>
      </FieldGroup>
      {wrongPortal && (
        <div role="alert" className="border-warning/40 bg-warning/5 space-y-2 rounded-lg border p-3 text-sm">
          <p>{wrongPortal.message}</p>
          {wrongPortal.portals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wrongPortal.portals.map((p) => (
                <Button key={p} asChild size="sm" variant="outline">
                  <Link href={PORTAL_LOGIN[p]}>Go to {PORTAL_NAME[p]} sign in</Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Sign in
      </Button>
      {portal === "customer" && (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setMode("magic")}>
          Email me a sign-in link instead
        </Button>
      )}
    </form>
  );
}

function MagicLinkRequest({ next, onBack }: { next: string; onBack: () => void }) {
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: "" } });
  const request = useMutation({
    mutationFn: (values: EmailOnlyInput) =>
      api("/auth/magic-link", { method: "POST", body: { ...values, redirectTo: next } }),
  });

  if (request.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="text-primary mx-auto size-10" aria-hidden />
        <p className="text-sm">
          If an account exists for <strong>{form.getValues("email")}</strong>, a sign-in link is on its way. It
          expires in 30 minutes.
        </p>
        <Button variant="outline" onClick={onBack} className="w-full">
          Back to password sign in
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
      <p className="text-muted-foreground text-sm">
        Bought a book without setting a password? We&apos;ll email you a one-time link to your library.
      </p>
      <FormField control={form.control} name="email" label="Email">
        {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Send sign-in link
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Use my password
      </Button>
    </form>
  );
}
