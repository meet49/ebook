"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  AFFILIATE_CHANNELS,
  AUDIENCE_SIZES,
  affiliateSignupSchema,
  type AffiliateSignupInput,
} from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAffiliateProfile, affiliateProfileKey } from "@/lib/affiliate";
import { api } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

type Values = AffiliateSignupInput;

/** Signed-in applicants already have an account: account fields are not validated. */
const signedInSchema = affiliateSignupSchema.extend({ name: z.string(), email: z.string(), password: z.string() });

export function AffiliateApplyForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user, isPending: userPending } = useMe();
  const { data: profile, isPending: profilePending } = useAffiliateProfile(Boolean(user));

  const form = useForm<Values>({
    // Signed-in users already have an account, so only the application fields are validated.
    resolver: zodResolver(user ? signedInSchema : affiliateSignupSchema),
    defaultValues: { name: "", email: "", password: "", website: "", channels: [], promotionPlan: "" },
  });

  if (userPending || (user && profilePending)) return <Skeleton className="h-96" />;

  if (profile && profile.status !== "rejected") {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <p>
          {profile.status === "pending"
            ? "Your application is under review. We'll email you when it's approved."
            : profile.status === "approved"
              ? "You're already an approved affiliate."
              : "Your affiliate account is currently suspended."}
        </p>
        <Button asChild className="w-full">
          <Link href="/affiliate">Go to affiliate dashboard</Link>
        </Button>
      </div>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      const body = user
        ? { website: values.website, channels: values.channels, audienceSize: values.audienceSize, promotionPlan: values.promotionPlan, acceptTerms: values.acceptTerms }
        : values;
      await api("/affiliate/apply", { method: "POST", body });
      await Promise.all([qc.invalidateQueries({ queryKey: meQueryKey }), qc.invalidateQueries({ queryKey: affiliateProfileKey })]);
      toast.success("Application submitted! We'll review it shortly.");
      router.replace("/affiliate");
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      {profile?.status === "rejected" && (
        <p className="bg-muted rounded-lg p-3 text-sm">
          Your previous application was not approved{profile.reviewNote ? `: ${profile.reviewNote}` : "."} You can update it and apply again.
        </p>
      )}
      <FieldGroup>
        {user ? (
          <p className="text-muted-foreground text-sm">
            Applying as <span className="text-foreground font-medium">{user.email}</span>
          </p>
        ) : (
          <>
            <FormField control={form.control} name="name" label="Full name">
              {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="email" label="Email">
              {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="password" label="Password" description="At least 8 characters, with a letter and a number.">
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/affiliate/login?next=/affiliate/apply" className="text-primary font-medium hover:underline">
                Sign in first
              </Link>
            </p>
          </>
        )}

        <FormField control={form.control} name="website" label="Website or main profile URL" description="Optional.">
          {({ field, id, invalid }) => <Input id={id} type="url" placeholder="https://" aria-invalid={invalid} {...field} />}
        </FormField>

        <Controller
          control={form.control}
          name="channels"
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label">Where will you promote?</FieldLegend>
              <div className="grid grid-cols-2 gap-2">
                {AFFILIATE_CHANNELS.map((c) => {
                  const checked = field.value.includes(c);
                  return (
                    <Field key={c} orientation="horizontal">
                      <Checkbox
                        id={`ch-${c}`}
                        checked={checked}
                        onCheckedChange={(v) => field.onChange(v ? [...field.value, c] : field.value.filter((x) => x !== c))}
                      />
                      <FieldLabel htmlFor={`ch-${c}`} className="font-normal">
                        {c}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
              {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
            </FieldSet>
          )}
        />

        <Controller
          control={form.control}
          name="audienceSize"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="audienceSize">Audience size</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="audienceSize" className="w-full" aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error ? <FieldError errors={[{ message: "Choose your audience size" }]} /> : null}
            </Field>
          )}
        />

        <FormField control={form.control} name="promotionPlan" label="How will you promote our eBooks?">
          {({ field, id, invalid }) => <Textarea id={id} rows={4} aria-invalid={invalid} {...field} />}
        </FormField>

        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox id="acceptTerms" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
              <FieldLabel htmlFor="acceptTerms" className="font-normal">
                I agree to the{" "}
                <Link href="/affiliates" className="underline" target="_blank">
                  affiliate program rules
                </Link>{" "}
                and{" "}
                <Link href="/legal/terms" className="underline" target="_blank">
                  terms
                </Link>
                .
              </FieldLabel>
              {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Submit application
      </Button>
    </form>
  );
}
