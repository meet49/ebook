"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Info, Play, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, type Paginated, type PayoutStatus } from "@ebook/shared";
import { FilterPills, ListCard, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PayoutDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListSkeleton } from "../_components/admin-list";

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

const STATUS_TONE: Record<PayoutStatus, PillTone> = {
  requested: "primary",
  processing: "warning",
  paid: "success",
  rejected: "destructive",
};

const FILTERS: { value: PayoutStatus | "all"; label: string }[] = [
  { value: "requested", label: "Requested" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

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
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader eyebrow="Partners" title="Payouts" description="Review payout requests from affiliates and record each payment you make." />

      <div className="bg-primary/5 border-primary/20 mb-6 flex gap-3 rounded-2xl border p-4 text-sm">
        <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">Nothing is transferred automatically.</span> Pay affiliates manually from your bank or UPI app, then
          record the real transaction reference here.
        </p>
      </div>

      <ListCard
        toolbar={
          <>
            <FilterPills
              label="Filter by status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={FILTERS}
            />
            {data ? <p className="text-muted-foreground shrink-0 text-sm">{data.total} payouts</p> : null}
          </>
        }
      >
        {isPending ? (
          <ListSkeleton rows={4} />
        ) : !data?.items.length ? (
          <ListEmpty icon={Wallet} title="No payouts here" description="Affiliates request payouts from their dashboard once commissions are payable." />
        ) : (
          <Table className={cn("min-w-220 transition-opacity", isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                    <span className="font-medium">{dateFmt.format(new Date(p.createdAt))}</span>
                    <div className="text-muted-foreground text-xs">{p.commissionCount} commissions</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.affiliate.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {p.affiliate.email} · <span className="font-mono">{p.affiliate.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.destination ?? "—"}
                    {p.affiliateNote ? <div className="text-muted-foreground max-w-56 truncate text-xs italic">“{p.affiliateNote}”</div> : null}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={STATUS_TONE[p.status]} className="capitalize">
                      {p.status}
                    </StatusPill>
                    {p.reference ? <div className="mt-1 font-mono text-xs">{p.reference}</div> : null}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(p.amountPaise)}</TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    {p.status === "requested" && (
                      <Button size="sm" variant="ghost" disabled={start.isPending} onClick={() => start.mutate(p.id)}>
                        <Play /> Start
                      </Button>
                    )}
                    {(p.status === "requested" || p.status === "processing") && (
                      <>
                        <Button size="sm" onClick={() => setPaying(p)}>
                          <Banknote /> Record payment
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRejecting(p)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} /> : null}
      </ListCard>

      <Dialog
        open={paying !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPaying(null);
            setReference("");
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment of {paying ? formatINR(paying.amountPaise) : ""}</DialogTitle>
            <DialogDescription>First send the money from your bank or UPI app. Then enter the transaction reference it gave you.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/60 rounded-xl border p-4 text-sm">
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Pay to</p>
            {destination.isPending ? (
              <Skeleton className="h-12" />
            ) : destination.data?.method === "upi" ? (
              <p>
                UPI: <span className="font-mono font-medium">{destination.data.upiId}</span>
              </p>
            ) : destination.data ? (
              <dl className="grid grid-cols-[90px_1fr] gap-1.5">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{destination.data.accountName}</dd>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="font-mono">{destination.data.accountNumber}</dd>
                <dt className="text-muted-foreground">IFSC</dt>
                <dd className="font-mono">{destination.data.ifsc}</dd>
              </dl>
            ) : (
              <p className="text-destructive">Could not load payout details.</p>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor="ref">Transaction reference (UTR / UPI ref)</FieldLabel>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" className="font-mono" />
            <FieldDescription>Required. The payout is only marked paid with a real reference.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="paid-note">Internal note (optional)</FieldLabel>
            <Textarea id="paid-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button disabled={reference.trim().length < 4 || markPaid.isPending} onClick={() => markPaid.mutate()}>
              {markPaid.isPending ? <Spinner /> : null} Mark as paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setNote("");
          }
        }}
      >
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
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={note.trim().length < 3 || reject.isPending} onClick={() => reject.mutate()}>
              {reject.isPending ? <Spinner /> : null} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
