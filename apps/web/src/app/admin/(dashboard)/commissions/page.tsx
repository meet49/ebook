"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, HandCoins, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { COMMISSION_STATUSES, formatINR, type CommissionStatus, type Paginated } from "@ebook/shared";
import { CommissionStatusBadge } from "@/components/affiliate/commission-status";
import { FilterPills, ListCard, StatusPill } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { COMMISSION_STATUS_INFO, commissionLabel } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListSkeleton } from "../_components/admin-list";

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

const STATUS_DOT: Record<CommissionStatus, string> = {
  pending: "bg-muted-foreground/50",
  approved: "bg-primary",
  payable: "bg-success",
  processing: "bg-warning",
  paid: "bg-success/60",
  reversed: "bg-destructive",
};

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
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const changeStatus = (v: CommissionStatus | "all") => {
    setStatus(v);
    setPage(1);
    setSelected(new Set());
  };

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Commission ledger"
        description="Every affiliate commission with its full history. Approve pending entries after reviewing the sale."
        actions={
          selected.size > 0 ? (
            <Button size="lg" onClick={() => approve.mutate([...selected])} disabled={approve.isPending}>
              {approve.isPending ? <Spinner /> : <CheckCheck />} Approve {selected.size} selected
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {COMMISSION_STATUSES.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => changeStatus(s)}
              className={cn(
                "bg-card focus-visible:ring-ring/50 rounded-xl border p-3.5 text-left transition-all outline-none hover:shadow-sm focus-visible:ring-3",
                active && "border-primary/50 ring-primary/15 ring-2",
              )}
            >
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[s])} />
                {COMMISSION_STATUS_INFO[s].label}
              </span>
              <span className="mt-1 block font-semibold tabular-nums">{formatINR(data?.totals[s]?.amountPaise ?? 0)}</span>
              <span className="text-muted-foreground block text-xs">{data?.totals[s]?.count ?? 0} entries</span>
            </button>
          );
        })}
      </div>

      <ListCard
        toolbar={
          <>
            <FilterPills
              label="Filter by status"
              value={status}
              onChange={changeStatus}
              options={[...COMMISSION_STATUSES.map((s) => ({ value: s, label: COMMISSION_STATUS_INFO[s].label })), { value: "all" as const, label: "All" }]}
            />
            {data ? <p className="text-muted-foreground shrink-0 text-sm">{data.total} entries</p> : null}
          </>
        }
      >
        {isPending ? (
          <ListSkeleton rows={5} />
        ) : !data?.items.length ? (
          <ListEmpty icon={HandCoins} title="No commissions" description="Commissions are created automatically when an affiliate-referred payment is verified." />
        ) : (
          <Table className={cn("min-w-220 transition-opacity", isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                  <TableCell className="pl-4">
                    {c.status === "pending" && (
                      <Checkbox
                        aria-label={`Select commission for ${c.orderNumber}`}
                        checked={selected.has(c.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt.format(new Date(c.createdAt))}</TableCell>
                  <TableCell>
                    <CodeChip>{c.affiliateCode}</CodeChip>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{c.orderNumber}</span>
                    <span className="text-muted-foreground block max-w-44 truncate text-xs">{c.productTitle}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatINR(c.baseAmountPaise)} <span className="text-muted-foreground text-xs">@ {commissionLabel(c.rule)}</span>
                    {c.orderStatus !== "paid" && <span className="text-warning block text-xs font-medium capitalize">Order {c.orderStatus.replace("_", " ")}</span>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <CommissionStatusBadge status={c.status} />
                      {c.clawbackRequired && <StatusPill tone="destructive">Clawback</StatusPill>}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", c.status === "reversed" && "text-muted-foreground font-medium line-through")}>
                    {formatINR(c.amountPaise)}
                  </TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setHistory(c)}>
                      <History /> History
                    </Button>
                    {c.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => approve.mutate([c.id])}>
                        Approve
                      </Button>
                    )}
                    {["pending", "approved", "payable"].includes(c.status) && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setReverse(c)}>
                        Reverse
                      </Button>
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
        open={reverse !== null}
        onOpenChange={(o) => {
          if (!o) {
            setReverse(null);
            setNote("");
          }
        }}
      >
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
            <Button variant="outline" onClick={() => setReverse(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={note.trim().length < 3 || doReverse.isPending} onClick={() => doReverse.mutate()}>
              {doReverse.isPending ? <Spinner /> : null} Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={history !== null} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ledger history · {history?.orderNumber}</DialogTitle>
            <DialogDescription>Every status change is recorded and cannot be edited.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 border-l pl-5">
            {history?.history.map((h, i) => (
              <li key={i} className="relative text-sm">
                <span aria-hidden className={cn("border-background absolute top-1 -left-6.5 size-3 rounded-full border-2", STATUS_DOT[h.status])} />
                <div className="flex flex-wrap items-center gap-2">
                  <CommissionStatusBadge status={h.status} />
                  <span className="text-muted-foreground text-xs">{new Date(h.at).toLocaleString("en-IN")}</span>
                </div>
                {h.note ? <p className="text-muted-foreground mt-1">{h.note}</p> : null}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CodeChip({ children }: { children: string }) {
  return <span className="bg-muted rounded-md px-1.5 py-0.5 font-mono text-xs">{children}</span>;
}
