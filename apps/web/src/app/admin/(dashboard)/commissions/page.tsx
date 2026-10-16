"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { COMMISSION_STATUSES, formatINR, type CommissionStatus, type Paginated } from "@ebook/shared";
import { CommissionStatusBadge } from "@/components/affiliate/commission-status";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { COMMISSION_STATUS_INFO, commissionLabel } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";

interface LedgerEntry {
  id: string;
  affiliateCode: string;
  orderNumber: string;
  orderStatus: string;
  productTitle: string;
  baseAmountPaise: number;
  rule: { type: "percent" | "fixed"; value: number };
  amountPaise: number;
  status: CommissionStatus;
  holdUntil: string;
  clawbackRequired: boolean;
  history: { status: CommissionStatus; at: string; note: string | null }[];
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function AdminCommissionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CommissionStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reverse, setReverse] = useState<LedgerEntry | null>(null);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<LedgerEntry | null>(null);

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["admin", "commissions", status, page],
    queryFn: () =>
      api<Paginated<LedgerEntry> & { totals: Partial<Record<CommissionStatus, { amountPaise: number; count: number }>> }>(
        `/admin/commissions?page=${page}${status !== "all" ? `&status=${status}` : ""}`,
      ),
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "commissions"] });
  const approve = useMutation({
    mutationFn: (ids: string[]) => api<{ approved: number; nowPayable: number }>("/admin/commissions/approve", { method: "POST", body: { ids } }),
    onSuccess: async (r) => {
      toast.success(`${r.approved} approved${r.nowPayable ? `, ${r.nowPayable} now payable` : ""}`);
      setSelected(new Set());
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const doReverse = useMutation({
    mutationFn: () => api(`/admin/commissions/${reverse!.id}/reverse`, { method: "POST", body: { note } }),
    onSuccess: async () => {
      toast.success("Commission reversed");
      setReverse(null);
      setNote("");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pendingIds = data?.items.filter((c) => c.status === "pending").map((c) => c.id) ?? [];

  return (
    <>
      <PageHeader
        title="Commission ledger"
        description="Every affiliate commission with its full history. Approve pending entries after reviewing the sale."
        actions={
          selected.size > 0 ? (
            <Button onClick={() => approve.mutate([...selected])} disabled={approve.isPending}>
              Approve {selected.size} selected
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COMMISSION_STATUSES.map((s) => (
          <Card key={s} className="gap-1 py-3">
            <CardContent>
              <p className="text-muted-foreground text-xs">{COMMISSION_STATUS_INFO[s].label}</p>
              <p className="font-semibold tabular-nums">{formatINR(data?.totals[s]?.amountPaise ?? 0)}</p>
              <p className="text-muted-foreground text-xs">{data?.totals[s]?.count ?? 0} entries</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={status} onValueChange={(v) => { setStatus(v as CommissionStatus | "all"); setPage(1); setSelected(new Set()); }} className="mb-4">
        <TabsList className="flex-wrap">
          {COMMISSION_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>{COMMISSION_STATUS_INFO[s].label}</TabsTrigger>
          ))}
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><HandCoins /></EmptyMedia>
              <EmptyTitle>No commissions</EmptyTitle>
              <EmptyDescription>Commissions are created automatically when an affiliate-referred payment is verified.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4">
                  {pendingIds.length > 0 && (
                    <Checkbox
                      aria-label="Select all pending"
                      checked={pendingIds.every((id) => selected.has(id))}
                      onCheckedChange={(v) => setSelected(v ? new Set(pendingIds) : new Set())}
                    />
                  )}
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">
                    {c.status === "pending" && (
                      <Checkbox
                        aria-label={`Select commission for ${c.orderNumber}`}
                        checked={selected.has(c.id)}
                        onCheckedChange={(v) => setSelected((prev) => { const next = new Set(prev); if (v) next.add(c.id); else next.delete(c.id); return next; })}
                      />
                    )}
                  </TableCell>
                  <TableCell>{dateFmt.format(new Date(c.createdAt))}</TableCell>
                  <TableCell className="font-mono text-xs">{c.affiliateCode}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{c.orderNumber}</span>
                    <span className="text-muted-foreground block max-w-40 truncate text-xs">{c.productTitle}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatINR(c.baseAmountPaise)} <span className="text-muted-foreground text-xs">@ {commissionLabel(c.rule)}</span>
                    {c.orderStatus !== "paid" && <span className="text-warning block text-xs capitalize">Order {c.orderStatus.replace("_", " ")}</span>}
                  </TableCell>
                  <TableCell>
                    <CommissionStatusBadge status={c.status} />
                    {c.clawbackRequired && <Badge variant="destructive" className="ml-1">Clawback</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(c.amountPaise)}</TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setHistory(c)}>History</Button>
                    {c.status === "pending" && <Button size="sm" variant="outline" onClick={() => approve.mutate([c.id])}>Approve</Button>}
                    {["pending", "approved", "payable"].includes(c.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setReverse(c)}>Reverse</Button>
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

      <Dialog open={reverse !== null} onOpenChange={(o) => { if (!o) { setReverse(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse commission for {reverse?.orderNumber}?</DialogTitle>
            <DialogDescription>Use this for fraud or policy violations. Refunds reverse commissions automatically.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reverse-note">Reason (visible in the ledger)</FieldLabel>
            <Textarea id="reverse-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverse(null)}>Cancel</Button>
            <Button variant="destructive" disabled={note.trim().length < 3 || doReverse.isPending} onClick={() => doReverse.mutate()}>Reverse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={history !== null} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ledger history · {history?.orderNumber}</DialogTitle>
            <DialogDescription>Every status change is recorded and cannot be edited.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 border-l pl-4">
            {history?.history.map((h, i) => (
              <li key={i} className="text-sm">
                <CommissionStatusBadge status={h.status} />
                <span className="text-muted-foreground ml-2 text-xs">{new Date(h.at).toLocaleString("en-IN")}</span>
                {h.note ? <p className="text-muted-foreground mt-1">{h.note}</p> : null}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
