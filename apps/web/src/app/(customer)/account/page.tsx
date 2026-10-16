"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, MailWarning } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { passwordSchema, updateProfileSchema, type PublicUser, type UpdateProfileInput } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

export default function AccountPage() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile, email and password.</p>
      </div>
      <ProfileCard user={user} />
      <EmailCard user={user} />
      <PasswordCard user={user} />
    </div>
  );
}

function ProfileCard({ user }: { user: PublicUser }) {
  const qc = useQueryClient();
  const form = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), values: { name: user.name } });
  const save = useMutation({
    mutationFn: (values: UpdateProfileInput) => api<{ user: PublicUser }>("/auth/me", { method: "PATCH", body: values }),
    onSuccess: ({ user }) => {
      qc.setQueryData(meQueryKey, user);
      toast.success("Profile updated");
    },
  });

  return (
    <Card>
      <form noValidate onSubmit={form.handleSubmit((v) => save.mutateAsync(v).catch((e) => handleFormError(e, form.setError)))}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>This name appears on your receipts.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FormField control={form.control} name="name" label="Full name">
            {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
          </FormField>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function EmailCard({ user }: { user: PublicUser }) {
  const resend = useMutation({
    mutationFn: () => api("/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success("Verification email sent. Check your inbox."),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>Used for sign-in, receipts and account recovery.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{user.email}</span>
        {user.emailVerified ? (
          <Badge variant="secondary">
            <BadgeCheck /> Verified
          </Badge>
        ) : (
          <>
            <Badge variant="outline" className="text-warning">
              <MailWarning /> Not verified
            </Badge>
            <Button size="sm" variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isPending ? <Spinner /> : null}
              Send verification email
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
  const qc = useQueryClient();
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(
      user.hasPassword
        ? passwordFormSchema.refine((v) => v.currentPassword.length > 0, {
            path: ["currentPassword"],
            message: "Enter your current password",
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
      toast.success("Password saved. Other devices have been signed out.");
    },
  });

  return (
    <Card>
      <form noValidate onSubmit={form.handleSubmit((v) => change.mutateAsync(v).catch((e) => handleFormError(e, form.setError)))}>
        <CardHeader>
          <CardTitle>{user.hasPassword ? "Change password" : "Set a password"}</CardTitle>
          <CardDescription>
            {user.hasPassword
              ? "Changing your password signs you out on all other devices."
              : "Your account was created at checkout. Set a password to sign in without an email link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FieldGroup>
            {user.hasPassword && (
              <FormField control={form.control} name="currentPassword" label="Current password">
                {({ field, id, invalid }) => (
                  <PasswordInput id={id} autoComplete="current-password" aria-invalid={invalid} {...field} />
                )}
              </FormField>
            )}
            <FormField control={form.control} name="newPassword" label="New password" description="At least 8 characters, with a letter and a number.">
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="confirm" label="Confirm new password">
              {({ field, id, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />}
            </FormField>
          </FieldGroup>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {user.hasPassword ? "Update password" : "Set password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
