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
import { safeNext, useRegister } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const register = useRegister();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      toast.success("Account created. Check your inbox to verify your email.");
      router.replace(safeNext(params.get("next"), "/library"));
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <FormField control={form.control} name="name" label="Full name">
          {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField control={form.control} name="email" label="Email">
          {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
        </FormField>
        <FormField
          control={form.control}
          name="password"
          label="Password"
          description="At least 8 characters, with a letter and a number."
        >
          {({ field, id, invalid }) => (
            <PasswordInput id={id} autoComplete="new-password" aria-invalid={invalid} {...field} />
          )}
        </FormField>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : null}
        Create account
      </Button>
    </form>
  );
}
