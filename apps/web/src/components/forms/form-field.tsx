"use client";

import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

interface FormFieldProps<T extends FieldValues, TName extends FieldPath<T>, TOut> {
  control: Control<T, unknown, TOut>;
  name: TName;
  label: ReactNode;
  description?: ReactNode;
  /** Renders the input. Spread `field` and `aria-invalid` onto it. */
  children: (props: { field: ControllerRenderProps<T, TName>; id: string; invalid: boolean }) => ReactNode;
}

/** Accessible label + control + error wiring for React Hook Form fields. */
export function FormField<T extends FieldValues, TName extends FieldPath<T>, TOut = T>({
  control,
  name,
  label,
  description,
  children,
}: FormFieldProps<T, TName, TOut>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name}`;
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {children({ field, id, invalid: fieldState.invalid })}
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        );
      }}
    />
  );
}
