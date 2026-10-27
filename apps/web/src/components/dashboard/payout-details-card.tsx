"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { payoutDetailsSchema, type PayoutDestinationSummary, type PayoutDetailsInput } from "@ebook/shared";
import { IconChip } from "@/components/dashboard/list-ui";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { handleFormError } from "@/lib/forms";
import { cn } from "@/lib/utils";

/** UPI or bank details for payouts, shared by the affiliate and author portals. */
export function PayoutDetailsCard<P>({
  payout,
  endpoint,
  onSaved,
}: {
  payout: PayoutDestinationSummary | null;
  /** PUT endpoint that saves the details and returns the updated profile */
  endpoint: string;
  onSaved: (profile: P) => void;
}) {
  const t = useMessages().affiliate.profile;
  const [method, setMethod] = useState<"upi" | "bank_transfer">(payout?.method ?? "upi");
  const form = useForm<PayoutDetailsInput>({
    resolver: zodResolver(payoutDetailsSchema),
    defaultValues:
      payout?.method === "bank_transfer"
        ? { method: "bank_transfer", accountName: payout.accountName ?? "", accountNumber: "", ifsc: payout.ifsc ?? "" }
        : { method: "upi", upiId: payout?.upiId ?? "" },
  });

  const switchMethod = (m: "upi" | "bank_transfer") => {
    setMethod(m);
    form.reset(m === "upi" ? { method: "upi", upiId: "" } : { method: "bank_transfer", accountName: "", accountNumber: "", ifsc: "" });
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      const { profile: updated } = await api<{ profile: P }>(endpoint, { method: "PUT", body: values });
      onSaved(updated);
      toast.success(t.saved);
      if (values.method === "bank_transfer") form.setValue("accountNumber", "");
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  const methods = [
    { value: "upi" as const, label: t.upi, icon: Smartphone },
    { value: "bank_transfer" as const, label: t.bank, icon: Landmark },
  ];

  return (
    <Card className="rounded-2xl">
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <CardHeader>
          <div className="flex items-start gap-3">
            <IconChip icon={Wallet} tone="success" />
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle>{t.payoutTitle}</CardTitle>
              <CardDescription>
                {payout
                  ? payout.method === "upi"
                    ? t.currentUpi(payout.upiId ?? "")
                    : t.currentBank(payout.accountNumberLast4 ?? "", payout.ifsc ?? "")
                  : t.whereToSend}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="group" aria-label={t.methodLabel} className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const active = method === m.value;
              const Icon = m.icon;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => !active && switchMethod(m.value)}
                  className={cn(
                    "focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                    active ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {m.label}
                </button>
              );
            })}
          </div>
          <FieldGroup>
            {method === "upi" ? (
              <FormField control={form.control} name="upiId" label={t.upiId}>
                {({ field, id, invalid }) => <Input id={id} placeholder="name@okbank" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
              </FormField>
            ) : (
              <>
                <FormField control={form.control} name="accountName" label={t.accountName}>
                  {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
                <FormField control={form.control} name="accountNumber" label={t.accountNumber} description={t.accountNumberHint}>
                  {({ field, id, invalid }) => <Input id={id} inputMode="numeric" autoComplete="off" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
                <FormField control={form.control} name="ifsc" label={t.ifsc}>
                  {({ field, id, invalid }) => <Input id={id} placeholder="HDFC0001234" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
              </>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {t.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
