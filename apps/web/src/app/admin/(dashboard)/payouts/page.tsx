"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, type Paginated, type PayoutStatus } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PayoutDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdminPayout extends PayoutDto {
  affiliate: { code: string; name: string; email: string };
}

interface Destination {
  method: "upi" | "bank_transfer" | null;
  upiId: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
}

const STATUS: Record<PayoutStatus, string> = {
  requested: "bg-muted text-muted-foreground",
  processing: "bg-warning/15 text-warning border-warning/20",
  paid: "bg-success/15 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function AdminPayoutsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PayoutStatus | "all">("requested");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<AdminPayout | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayout | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["admin", "payouts", status, page],
    queryFn: () => api<Paginated<AdminPayout>>(`/admin/payouts?page=${page}${status !== "all" ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const destination = useQuery({
    queryKey: ["admin", "payout-destination", paying?.id],
    queryFn: () => api<Destination>(`/admin/payouts/${paying!.id}/destination`),
    enabled: paying !== null,
    staleTime: 0,
    gcTime: 0,
  });

  const done = async (message: string) => {
    toast.success(message);
    setPaying(null);
    setRejecting(null);
    setReference("");
    setNote("");
    await qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
  };
  const markPaid = useMutation({
    mutationFn: () => api(`/admin/payouts/${paying!.id}/mark-paid`, { method: "POST", body: { reference, note } }),
    onSuccess: () => done("Payout recorded as paid. The affiliate has been notified."),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: () => api(`/admin/payouts/${rejecting!.id}/reject`, { method: "POST", body: { note } }),
    onSuccess: () => done("Payout rejected; commissions returned to payable"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const start = useMutation({
    mutationFn: (id: string) => api(`/admin/payouts/${id}/start`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payouts"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Pay affiliates manually from your bank or UPI app, then record the real transaction reference here. Nothing is transferred automatically."
      />
      <Tabs value={status} onValueChange={(v) => { setStatus(v as PayoutStatus | "all"); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="requested">Requested</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Wallet /></EmptyMedia>
              <EmptyTitle>No payouts here</EmptyTitle>
              <EmptyDescription>Affiliates request payouts from their dashboard once commissions are payable.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Requested</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4">
                    {dateFmt.format(new Date(p.createdAt))}
                    <div className="text-muted-foreground text-xs">{p.commissionCount} commissions</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.affiliate.name}</div>
                    <div className="text-muted-foreground text-xs">{p.affiliate.email} · {p.affiliate.code}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.destination}
                    {p.affiliateNote ? <div className="text-muted-foreground text-xs">“{p.affiliateNote}”</div> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", STATUS[p.status])}>{p.status}</Badge>
                    {p.reference ? <div className="mt-1 font-mono text-xs">{p.reference}</div> : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(p.amountPaise)}</TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    {p.status === "requested" && <Button size="sm" variant="ghost" onClick={() => start.mutate(p.id)}>Start</Button>}
                    {(p.status === "requested" || p.status === "processing") && (
                      <>
                        <Button size="sm" onClick={() => setPaying(p)}>Record payment</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(p)}>Reject</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={paying !== null} onOpenChange={(o) => { if (!o) { setPaying(null); setReference(""); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment of {paying ? formatINR(paying.amountPaise) : ""}</DialogTitle>
            <DialogDescription>First send the money from your bank or UPI app. Then enter the transaction reference it gave you.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-3 text-sm">
            {destination.isPending ? (
              <Skeleton className="h-12" />
            ) : destination.data?.method === "upi" ? (
              <p>UPI: <span className="font-mono">{destination.data.upiId}</span></p>
            ) : destination.data ? (
              <dl className="grid grid-cols-[110px_1fr] gap-1">
                <dt className="text-muted-foreground">Name</dt><dd>{destination.data.accountName}</dd>
                <dt className="text-muted-foreground">Account</dt><dd className="font-mono">{destination.data.accountNumber}</dd>
                <dt className="text-muted-foreground">IFSC</dt><dd className="font-mono">{destination.data.ifsc}</dd>
              </dl>
            ) : (
              <p className="text-destructive">Could not load payout details.</p>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor="ref">Transaction reference (UTR / UPI ref)</FieldLabel>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
            <FieldDescription>Required. The payout is only marked paid with a real reference.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="paid-note">Internal note (optional)</FieldLabel>
            <Textarea id="paid-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button disabled={reference.trim().length < 4 || markPaid.isPending} onClick={() => markPaid.mutate()}>
              {markPaid.isPending ? <Spinner /> : null} Mark as paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={(o) => { if (!o) { setRejecting(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payout request?</DialogTitle>
            <DialogDescription>The commissions go back to payable so the affiliate can request again after fixing the issue.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-note">Reason (shown to the affiliate)</FieldLabel>
            <Textarea id="reject-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={note.trim().length < 3 || reject.isPending} onClick={() => reject.mutate()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
