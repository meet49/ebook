"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Clock, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, type PayoutStatus } from "@ebook/shared";
import { ListCard, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/i18n/client";
import type { PayoutDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";

interface PayoutSummary {
  payablePaise: number;
  payableCount: number;
  minimumPaise: number;
  hasPayoutDetails: boolean;
  items: PayoutDto[];
}

const PAYOUT_TONE: Record<PayoutStatus, PillTone> = {
  requested: "muted",
  processing: "warning",
  paid: "success",
  rejected: "destructive",
};

export default function AffiliatePayoutsPage() {
  const messages = useMessages();
  const a = messages.affiliate;
  const t = a.payouts;
  const fmt = useAffiliateFormat();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data, isPending } = useQuery({ queryKey: ["affiliate", "payouts"], queryFn: () => api<PayoutSummary>("/affiliate/payouts") });
  const request = useMutation({
    mutationFn: () => api("/affiliate/payouts", { method: "POST", body: { note } }),
    onSuccess: async () => {
      toast.success(t.requested);
      setNote("");
      await qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const inFlight = data?.items.some((p) => p.status === "requested" || p.status === "processing");
  const canRequest = data && data.hasPayoutDetails && !inFlight && data.payablePaise >= data.minimumPaise;
  const progress = data && data.minimumPaise > 0 ? Math.min(100, Math.round((data.payablePaise / data.minimumPaise) * 100)) : 100;
  const belowMinimum = data ? data.payablePaise < data.minimumPaise : false;

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={messages.common.dashboard.affiliate.payouts} description={t.description} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-6">
          {/* Balance */}
          <section className="bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-6" aria-labelledby="balance-label">
            <div aria-hidden className="bg-gradient-brand pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.14]" />
            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <p id="balance-label" className="text-muted-foreground text-sm font-medium">
                  {t.available}
                </p>
                <span className="bg-success/10 text-success flex size-9 items-center justify-center rounded-xl">
                  <Wallet className="size-4.5" aria-hidden />
                </span>
              </div>
              {isPending || !data ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{formatINR(data.payablePaise)}</p>
              )}
              {data ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">
                    {t.payableCount(data.payableCount)} · {t.minimum(formatINR(data.minimumPaise))}
                  </p>
                  {belowMinimum ? (
                    <>
                      <div
                        role="progressbar"
                        aria-label={t.progressLabel}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="bg-muted h-2 overflow-hidden rounded-full"
                      >
                        <div className="bg-gradient-brand h-full rounded-full transition-[width]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-muted-foreground text-xs">{t.toMinimum(formatINR(data.minimumPaise - data.payablePaise))}</p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* Request */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{t.requestTitle}</CardTitle>
              <CardDescription>{t.requestBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data && !data.hasPayoutDetails && (
                <div className="bg-warning/10 border-warning/25 flex gap-2.5 rounded-xl border p-3 text-sm">
                  <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    {t.needDetails}{" "}
                    <Link href="/affiliate/profile" className="text-primary font-medium hover:underline">
                      {t.addDetails}
                    </Link>
                  </p>
                </div>
              )}
              {inFlight && (
                <div className="bg-muted/60 flex gap-2.5 rounded-xl p-3 text-sm">
                  <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="text-muted-foreground">{t.inFlight}</p>
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="payout-note">{t.note}</FieldLabel>
                <Textarea id="payout-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button size="lg" className="w-full" disabled={!canRequest || request.isPending} onClick={() => request.mutate()}>
                {request.isPending ? <Spinner /> : <ArrowRight />}
                {data ? t.requestAmount(formatINR(data.payablePaise)) : t.requestGeneric}
              </Button>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="bg-muted/30 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t.howTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {t.how.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <ListCard
          className="h-fit"
          toolbar={<h2 className="font-semibold">{t.historyTitle}</h2>}
        >
          {isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wallet />
                </EmptyMedia>
                <EmptyTitle>{t.emptyTitle}</EmptyTitle>
                <EmptyDescription>{t.emptyBody}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ul className="divide-y md:hidden">
                {data.items.map((p) => (
                  <li key={p.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{fmt.date(p.createdAt)}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {t.commissionsCount(p.commissionCount)}
                          {p.destination ? ` · ${p.destination}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-semibold tabular-nums">{formatINR(p.amountPaise)}</p>
                    </div>
                    <StatusPill tone={PAYOUT_TONE[p.status]}>{a.payoutStatus[p.status]}</StatusPill>
                    {p.reference ? <p className="font-mono text-xs break-all">{p.reference}</p> : null}
                    {p.paidAt ? <p className="text-muted-foreground text-xs">{t.paidOn(fmt.date(p.paidAt))}</p> : null}
                    {p.status === "rejected" && p.adminNote ? <p className="text-muted-foreground text-xs">{p.adminNote}</p> : null}
                  </li>
                ))}
              </ul>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">{t.colRequested}</TableHead>
                    <TableHead>{t.colStatus}</TableHead>
                    <TableHead>{t.colReference}</TableHead>
                    <TableHead className="pr-4 text-right">{t.colAmount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <span className="font-medium">{fmt.date(p.createdAt)}</span>
                        <div className="text-muted-foreground max-w-56 truncate text-xs">
                          {t.commissionsCount(p.commissionCount)}
                          {p.destination ? ` · ${p.destination}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={PAYOUT_TONE[p.status]}>{a.payoutStatus[p.status]}</StatusPill>
                        {p.status === "rejected" && p.adminNote ? <div className="text-muted-foreground mt-1 max-w-56 text-xs whitespace-normal">{p.adminNote}</div> : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.reference ?? "—"}
                        {p.paidAt ? <div className="text-muted-foreground font-sans">{t.paidOn(fmt.date(p.paidAt))}</div> : null}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-semibold tabular-nums">{formatINR(p.amountPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </ListCard>
      </div>
    </>
  );
}
