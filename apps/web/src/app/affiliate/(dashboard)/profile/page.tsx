"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, FileText, Landmark, Smartphone, UserRound, Wallet } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { payoutDetailsSchema, type AffiliateStatus, type PayoutDetailsInput } from "@ebook/shared";
import { IconChip, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { affiliateProfileKey, useAffiliateProfile, type AffiliateProfileDto } from "@/lib/affiliate";
import { api } from "@/lib/api";
import { handleFormError } from "@/lib/forms";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<AffiliateStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "muted",
  suspended: "destructive",
};

export default function AffiliateProfilePage() {
  const t = useMessages().affiliate.profile;
  const { data: profile, isPending } = useAffiliateProfile();
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      {isPending ? (
        <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !profile ? (
        <Empty className="bg-card rounded-2xl border border-solid">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>{t.notApplied}</EmptyTitle>
            <EmptyDescription>{t.notAppliedBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/affiliate/apply">
                {t.applyNow} <ArrowRight />
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
          <PayoutDetailsCard profile={profile} />
          <ApplicationCard profile={profile} />
        </div>
      )}
    </>
  );
}

function ApplicationCard({ profile }: { profile: AffiliateProfileDto }) {
  const messages = useMessages();
  const a = messages.affiliate;
  const t = a.profile;
  const fmt = useAffiliateFormat();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.code);
      toast.success(t.codeCopied);
    } catch {
      toast.error(a.common.copyFailed);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <IconChip icon={FileText} tone="violet" />
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t.applicationTitle}
              <StatusPill tone={STATUS_TONE[profile.status]}>{a.accountStatus[profile.status]}</StatusPill>
            </CardTitle>
            <CardDescription>{t.appliedOn(fmt.date(profile.application.submittedAt ?? profile.createdAt))}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{t.code}</p>
            <p className="truncate font-mono text-lg font-semibold tracking-wide">{profile.code}</p>
          </div>
          <Button variant="outline" size="icon-lg" className="bg-background" onClick={copyCode} aria-label={t.copyCode}>
            <Copy />
          </Button>
        </div>
        <dl className="space-y-4 text-sm">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.website}</dt>
            <dd className="break-all">{profile.application.website || "—"}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-muted-foreground text-xs font-medium">{t.channels}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {profile.application.channels.length
                ? profile.application.channels.map((c) => (
                    <Badge key={c} variant="secondary">
                      {a.channels[c] ?? c}
                    </Badge>
                  ))
                : "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.audience}</dt>
            <dd>{a.audience[profile.application.audienceSize] ?? profile.application.audienceSize}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.plan}</dt>
            <dd className="bg-muted/40 rounded-lg p-3 whitespace-pre-line">{profile.application.promotionPlan}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function PayoutDetailsCard({ profile }: { profile: AffiliateProfileDto }) {
  const t = useMessages().affiliate.profile;
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
                {profile.payout
                  ? profile.payout.method === "upi"
                    ? t.currentUpi(profile.payout.upiId ?? "")
                    : t.currentBank(profile.payout.accountNumberLast4 ?? "", profile.payout.ifsc ?? "")
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
