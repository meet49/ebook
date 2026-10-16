"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { payoutDetailsSchema, type PayoutDetailsInput } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { affiliateProfileKey, useAffiliateProfile, type AffiliateProfileDto } from "@/lib/affiliate";
import { api } from "@/lib/api";
import { handleFormError } from "@/lib/forms";

export default function AffiliateProfilePage() {
  const { data: profile, isPending } = useAffiliateProfile();
  return (
    <>
      <PageHeader title="Affiliate profile" description="Your application and where we send your payouts." />
      {isPending ? (
        <Skeleton className="h-64" />
      ) : !profile ? (
        <p className="text-muted-foreground">You haven&apos;t applied yet.</p>
      ) : (
        <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
          <PayoutDetailsCard profile={profile} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Application <Badge variant="secondary" className="capitalize">{profile.status}</Badge>
              </CardTitle>
              <CardDescription>Affiliate code {profile.code}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd>{profile.application.website || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Channels</dt>
                  <dd>{profile.application.channels.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd>{profile.application.audienceSize}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Promotion plan</dt>
                  <dd className="whitespace-pre-line">{profile.application.promotionPlan}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function PayoutDetailsCard({ profile }: { profile: AffiliateProfileDto }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<"upi" | "bank_transfer">(profile.payout?.method ?? "upi");
  const form = useForm<PayoutDetailsInput>({
    resolver: zodResolver(payoutDetailsSchema),
    defaultValues:
      profile.payout?.method === "bank_transfer"
        ? { method: "bank_transfer", accountName: profile.payout.accountName ?? "", accountNumber: "", ifsc: profile.payout.ifsc ?? "" }
        : { method: "upi", upiId: profile.payout?.upiId ?? "" },
  });

  const switchMethod = (m: "upi" | "bank_transfer") => {
    setMethod(m);
    form.reset(m === "upi" ? { method: "upi", upiId: "" } : { method: "bank_transfer", accountName: "", accountNumber: "", ifsc: "" });
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      const { profile: updated } = await api<{ profile: AffiliateProfileDto }>("/affiliate/me/payout", { method: "PUT", body: values });
      qc.setQueryData(affiliateProfileKey, updated);
      toast.success("Payout details saved");
      if (values.method === "bank_transfer") form.setValue("accountNumber", "");
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  return (
    <Card>
      <form noValidate onSubmit={submit}>
        <CardHeader>
          <CardTitle>Payout details</CardTitle>
          <CardDescription>
            {profile.payout
              ? profile.payout.method === "upi"
                ? `Current: UPI ${profile.payout.upiId}`
                : `Current: bank account ••••${profile.payout.accountNumberLast4} (${profile.payout.ifsc})`
              : "Where should we send your earnings?"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <Tabs value={method} onValueChange={(v) => switchMethod(v as "upi" | "bank_transfer")}>
            <TabsList>
              <TabsTrigger value="upi">UPI</TabsTrigger>
              <TabsTrigger value="bank_transfer">Bank transfer</TabsTrigger>
            </TabsList>
          </Tabs>
          <FieldGroup>
            {method === "upi" ? (
              <FormField control={form.control} name="upiId" label="UPI ID">
                {({ field, id, invalid }) => <Input id={id} placeholder="name@okbank" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
              </FormField>
            ) : (
              <>
                <FormField control={form.control} name="accountName" label="Account holder name">
                  {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
                <FormField control={form.control} name="accountNumber" label="Account number" description="Stored encrypted. Only the last 4 digits are shown back to you.">
                  {({ field, id, invalid }) => <Input id={id} inputMode="numeric" autoComplete="off" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
                <FormField control={form.control} name="ifsc" label="IFSC code">
                  {({ field, id, invalid }) => <Input id={id} placeholder="HDFC0001234" aria-invalid={invalid} {...field} value={(field.value as string) ?? ""} />}
                </FormField>
              </>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            Save payout details
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
