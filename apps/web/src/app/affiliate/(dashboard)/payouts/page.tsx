"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, type PayoutStatus } from "@ebook/shared";
import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PayoutDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PayoutSummary {
  payablePaise: number;
  payableCount: number;
  minimumPaise: number;
  hasPayoutDetails: boolean;
  items: PayoutDto[];
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; className: string }> = {
  requested: { label: "Requested", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-warning/15 text-warning border-warning/20" },
  paid: { label: "Paid", className: "bg-success/15 text-success border-success/20" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function AffiliatePayoutsPage() {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data, isPending } = useQuery({ queryKey: ["affiliate", "payouts"], queryFn: () => api<PayoutSummary>("/affiliate/payouts") });
  const request = useMutation({
    mutationFn: () => api("/affiliate/payouts", { method: "POST", body: { note } }),
    onSuccess: async () => {
      toast.success("Payout requested. We'll notify you when it's paid.");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const inFlight = data?.items.some((p) => p.status === "requested" || p.status === "processing");
  const canRequest = data && data.hasPayoutDetails && !inFlight && data.payablePaise >= data.minimumPaise;

  return (
    <>
      <PageHeader title="Payouts" description="Request payment of your payable commissions. Payouts are reviewed and paid manually." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <StatTile
            label="Available to withdraw"
            icon={Wallet}
            loading={isPending}
            value={data ? formatINR(data.payablePaise) : undefined}
            hint={data ? `${data.payableCount} payable commission${data.payableCount === 1 ? "" : "s"} · minimum ${formatINR(data.minimumPaise)}` : undefined}
          />
          <Card>
            <CardHeader>
              <CardTitle>Request a payout</CardTitle>
              <CardDescription>All payable commissions are included in one request.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data && !data.hasPayoutDetails && (
                <p className="bg-warning/10 rounded-lg p-3 text-sm">
                  Add your UPI or bank details first.{" "}
                  <Link href="/affiliate/profile" className="text-primary font-medium hover:underline">
                    Add payout details
                  </Link>
                </p>
              )}
              {inFlight && <p className="text-muted-foreground text-sm">You have a payout in progress. You can request again once it&apos;s settled.</p>}
              <Field>
                <FieldLabel htmlFor="payout-note">Note for our team (optional)</FieldLabel>
                <Textarea id="payout-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button className="w-full" disabled={!canRequest || request.isPending} onClick={() => request.mutate()}>
                {request.isPending ? <Spinner /> : null}
                Request {data ? formatINR(data.payablePaise) : "payout"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit overflow-hidden py-0">
          <CardHeader className="pt-6">
            <CardTitle>Payout history</CardTitle>
          </CardHeader>
          {isPending ? (
            <Skeleton className="m-4 h-32" />
          ) : !data?.items.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wallet />
                </EmptyMedia>
                <EmptyTitle>No payouts yet</EmptyTitle>
                <EmptyDescription>Your payout requests and their references will appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6">
                      {dateFmt.format(new Date(p.createdAt))}
                      <div className="text-muted-foreground text-xs">{p.destination}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(PAYOUT_STATUS[p.status].className)}>
                        {PAYOUT_STATUS[p.status].label}
                      </Badge>
                      {p.status === "rejected" && p.adminNote ? <div className="text-muted-foreground mt-1 text-xs">{p.adminNote}</div> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.reference ?? "—"}
                      {p.paidAt ? <div className="text-muted-foreground font-sans">{dateFmt.format(new Date(p.paidAt))}</div> : null}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">{formatINR(p.amountPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
