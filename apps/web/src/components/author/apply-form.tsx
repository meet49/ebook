"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Info, UserRound } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authorSignupSchema, type AuthorSignupInput } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/auth";
import { authorProfileKey, useAuthorProfile } from "@/lib/author";
import { handleFormError } from "@/lib/forms";

type Values = AuthorSignupInput;

/** Signed-in applicants already have an account: account fields are not validated. */
const signedInSchema = authorSignupSchema.extend({ name: z.string(), email: z.string(), password: z.string() });

function SectionTitle({ children }: { children: string }) {
  return <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{children}</p>;
}

export function AuthorApplyForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const messages = useMessages();
  const f = messages.author.form;
  const validation = messages.common.validation;
  const { data: user, isPending: userPending } = useMe();
  const { data: profile, isPending: profilePending } = useAuthorProfile(Boolean(user));

  const form = useForm<Values>({
    resolver: zodResolver(user ? signedInSchema : authorSignupSchema),
    defaultValues: { name: "", email: "", password: "", penName: "", bio: "", website: "", aboutBooks: "" },
  });

  if (userPending || (user && profilePending)) return <Skeleton className="h-96 rounded-xl" />;

  if (profile && profile.status !== "rejected") {
    return (
      <div className="space-y-5 py-4 text-center">
        <span className="bg-success/10 text-success mx-auto flex size-14 items-center justify-center rounded-2xl">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <p className="text-balance">
          {profile.status === "pending" ? f.alreadyPending : profile.status === "approved" ? f.alreadyApproved : f.alreadySuspended}
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/author">
            {f.goToDashboard} <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      const body = user
        ? { penName: values.penName, bio: values.bio, website: values.website, aboutBooks: values.aboutBooks, acceptTerms: values.acceptTerms }
        : values;
      await api("/author/apply", { method: "POST", body });
      await Promise.all([qc.invalidateQueries({ queryKey: meQueryKey }), qc.invalidateQueries({ queryKey: authorProfileKey })]);
      toast.success(f.submitted);
      router.replace("/author");
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  const translateError = (message?: string) => (message ? (validation[message] ?? message) : message);

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      {profile?.status === "rejected" && (
        <p className="bg-warning/10 border-warning/25 flex gap-2.5 rounded-xl border p-3 text-sm">
          <Info className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {f.previousRejected(profile.reviewNote)} {f.applyAgainHint}
          </span>
        </p>
      )}
      <FieldGroup>
        {user ? (
          <div className="bg-muted/60 flex items-center gap-3 rounded-xl p-3 text-sm">
            <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <UserRound className="text-muted-foreground size-4" aria-hidden />
            </span>
            <p className="min-w-0">
              <span className="text-muted-foreground block text-xs">{f.applyingAs}</span>
              <span className="block truncate font-medium">{user.email}</span>
            </p>
          </div>
        ) : (
          <>
            <SectionTitle>{f.accountSection}</SectionTitle>
            <FormField control={form.control} name="name" label={f.name}>
              {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="email" label={f.email}>
              {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="password" label={f.password} description={f.passwordHint}>
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
            <p className="text-muted-foreground text-sm">
              {f.haveAccount}{" "}
              <Link href="/author/login?next=/author/apply" className="text-primary font-medium hover:underline">
                {f.signInFirst}
              </Link>
            </p>
          </>
        )}

        <SectionTitle>{f.aboutSection}</SectionTitle>
        <FormField control={form.control} name="penName" label={f.penName} description={f.penNameHint}>
          {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField control={form.control} name="bio" label={f.bio} description={f.optional}>
          {({ field, id, invalid }) => <Textarea id={id} rows={3} aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField control={form.control} name="website" label={f.website} description={f.optional}>
          {({ field, id, invalid }) => <Input id={id} type="url" placeholder="https://" aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField control={form.control} name="aboutBooks" label={f.aboutBooks} description={f.aboutBooksHint}>
          {({ field, id, invalid }) => <Textarea id={id} rows={4} aria-invalid={invalid} {...field} />}
        </FormField>

        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="bg-muted/40 rounded-xl p-3">
              <Checkbox id="acceptTerms" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
              <FieldLabel htmlFor="acceptTerms" className="block font-normal">
                {f.termsPrefix}
                <Link href="/legal/terms" className="underline underline-offset-2" target="_blank">
                  {f.termsLink}
                </Link>
                {f.termsSuffix}
              </FieldLabel>
              {fieldState.error ? <FieldError errors={[{ message: translateError(fieldState.error.message) }]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        {f.submit}
      </Button>
    </form>
  );
}
