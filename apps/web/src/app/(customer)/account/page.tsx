"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, KeyRound, Mail, MailWarning, UserRound, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { passwordSchema, updateProfileSchema, type PublicUser, type UpdateProfileInput } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useIntlLocale, useMessages } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

export default function AccountPage() {
  const t = useMessages().library.account;
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <div className="space-y-6">
        <SummaryCard user={user} />
        <ProfileCard user={user} />
        <EmailCard user={user} />
        <PasswordCard user={user} />
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

function SummaryCard({ user }: { user: PublicUser }) {
  const t = useMessages().library.account;
  const locale = useIntlLocale();
  const since = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(user.createdAt)),
    [locale, user.createdAt],
  );
  return (
    <div className="bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-6">
      <div aria-hidden className="from-accent/70 absolute inset-0 bg-linear-to-r to-transparent" />
      <div className="relative flex items-center gap-4">
        <span
          className="bg-gradient-brand flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-sm"
          aria-hidden
        >
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-tight">{user.name}</p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{t.memberSince(since)}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: ReactNode; description: ReactNode }) {
  return (
    <CardHeader className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="space-y-1">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

function ProfileCard({ user }: { user: PublicUser }) {
  const m = useMessages();
  const t = m.library.account.profile;
  const qc = useQueryClient();
  const form = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), values: { name: user.name } });
  const save = useMutation({
    mutationFn: (values: UpdateProfileInput) => api<{ user: PublicUser }>("/auth/me", { method: "PATCH", body: values }),
    onSuccess: ({ user }) => {
      qc.setQueryData(meQueryKey, user);
      toast.success(t.saved);
    },
  });

  return (
    <Card className="rounded-2xl">
      <form noValidate onSubmit={form.handleSubmit((v) => save.mutateAsync(v).catch((e) => handleFormError(e, form.setError)))}>
        <SectionHeader icon={UserRound} title={t.title} description={t.description} />
        <CardContent className="pt-6">
          <FormField control={form.control} name="name" label={t.fullName}>
            {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
          </FormField>
        </CardContent>
        <CardFooter className="mt-6 justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {m.common.actions.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function EmailCard({ user }: { user: PublicUser }) {
  const t = useMessages().library.account.email;
  const resend = useMutation({
    mutationFn: () => api("/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success(t.sent),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card className="rounded-2xl">
      <SectionHeader icon={Mail} title={t.title} description={t.description} />
      <CardContent className="flex flex-wrap items-center gap-3 pt-2">
        <span className="font-medium break-all">{user.email}</span>
        {user.emailVerified ? (
          <Badge variant="outline" className="bg-success/15 text-success border-success/20">
            <BadgeCheck /> {t.verified}
          </Badge>
        ) : (
          <>
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/20">
              <MailWarning /> {t.notVerified}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? <Spinner /> : null}
              {t.send}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const passwordFormSchema = z
  .object({ currentPassword: z.string().max(128), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

function PasswordCard({ user }: { user: PublicUser }) {
  const t = useMessages().library.account.password;
  const qc = useQueryClient();
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(
      user.hasPassword
        ? passwordFormSchema.refine((v) => v.currentPassword.length > 0, {
            path: ["currentPassword"],
            message: t.enterCurrent,
          })
        : passwordFormSchema,
    ),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const change = useMutation({
    mutationFn: (v: PasswordFormValues) =>
      api<{ user: PublicUser }>("/auth/change-password", {
        method: "POST",
        body: { currentPassword: user.hasPassword ? v.currentPassword : undefined, newPassword: v.newPassword },
      }),
    onSuccess: ({ user }) => {
      qc.setQueryData(meQueryKey, user);
      form.reset();
      toast.success(t.saved);
    },
  });

  return (
    <Card className="rounded-2xl">
      <form noValidate onSubmit={form.handleSubmit((v) => change.mutateAsync(v).catch((e) => handleFormError(e, form.setError)))}>
        <SectionHeader
          icon={KeyRound}
          title={user.hasPassword ? t.changeTitle : t.setTitle}
          description={user.hasPassword ? t.changeDescription : t.setDescription}
        />
        <CardContent className="pt-6">
          <FieldGroup>
            {user.hasPassword && (
              <FormField control={form.control} name="currentPassword" label={t.current}>
                {({ field, id, invalid }) => (
                  <PasswordInput id={id} autoComplete="current-password" aria-invalid={invalid} {...field} />
                )}
              </FormField>
            )}
            <FormField control={form.control} name="newPassword" label={t.new} description={t.hint}>
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="confirm" label={t.confirm}>
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {user.hasPassword ? t.update : t.set}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
