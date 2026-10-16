"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { registerSchema, type RegisterInput } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { safeNext, useRegister } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const register = useRegister();
  const t = useMessages().auth.form;
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      toast.success(t.accountCreated);
      router.replace(safeNext(params.get("next"), "/library"));
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <FormField control={form.control} name="name" label={t.fullName}>
          {({ field, id, invalid }) => (
            <Input id={id} autoComplete="name" placeholder={t.namePlaceholder} className="h-11" aria-invalid={invalid} {...field} />
          )}
        </FormField>
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
        <FormField control={form.control} name="password" label={t.password} description={t.passwordHint}>
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="new-password" className="h-11" aria-invalid={invalid} {...field} />
          )}
        </FormField>
      </FieldGroup>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        {t.createAccount}
      </Button>
    </form>
  );
}
