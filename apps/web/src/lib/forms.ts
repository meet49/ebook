import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ApiError, errorMessage } from "./api";

/**
 * Maps API validation errors onto form fields; anything that is not field-specific
 * becomes a toast. Returns the top-level message for inline display if wanted.
 */
export function handleFormError<T extends FieldValues>(err: unknown, setError?: UseFormSetError<T>): string {
  if (err instanceof ApiError && err.details && setError) {
    let mapped = false;
    for (const [field, messages] of Object.entries(err.details)) {
      if (field === "_" || !messages[0]) continue;
      setError(field as Path<T>, { type: "server", message: messages[0] });
      mapped = true;
    }
    if (mapped) return err.message;
  }
  const message = errorMessage(err);
  toast.error(message);
  return message;
}
