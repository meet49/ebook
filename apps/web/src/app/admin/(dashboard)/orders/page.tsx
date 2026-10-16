"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, RefreshCw, Search, Undo2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { formatINR, rupeesToPaise, type OrderStatus, type Paginated } from "@ebook/shared";
import { OrderStatusBadge } from "@/components/checkout/order-status";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import type { AdminOrder } from "@/lib/types";

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partly refunded" },
  { value: "failed", label: "Failed" },
  { value: "created", label: "Abandoned" },
];

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

interface OrderDetail {
  order: AdminOrder;
  events: { eventId: string; type: string; status: string; error: string | null; createdAt: string }[];
  commission: { amountPaise: number; status: string; clawbackRequired: boolean } | null;
}

export default function AdminOrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const deferredQ = useDeferredValue(q.trim());

  const search = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (deferredQ) search.set("q", deferredQ);
  if (status !== "all") search.set("status", status);
  const { data, isPending, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["admin", "orders", deferredQ, status, page],
    queryFn: () => api<Paginated<AdminOrder>>(`/admin/orders?${search}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Orders & refunds" description="Verified payments, refunds and payment history." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => { setStatus(v as OrderStatus | "all"); setPage(1); }}>
          <TabsList className="flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full lg:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Order no., email, title, payment ID" className="pl-9" aria-label="Search orders" />
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        {isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Couldn&apos;t load orders</EmptyTitle>
              <EmptyDescription>
                <Button variant="outline" onClick={() => refetch()}>Try again</Button>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isPending ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
              <EmptyTitle>No orders</EmptyTitle>
              <EmptyDescription>Orders appear here once customers check out.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>eBook</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o.id)}>
                  <TableCell className="pl-4">
                    <div className="font-mono text-xs">{o.orderNumber}</div>
                    <div className="text-muted-foreground text-xs">{dateFmt.format(new Date(o.createdAt))}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customer.name}</div>
                    <div className="text-muted-foreground text-xs">{o.customer.email}</div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{o.product.title}</TableCell>
                  <TableCell>
                    {o.attribution.type === "affiliate" ? <Badge variant="secondary">Affiliate {o.attribution.affiliateCode}</Badge> : <span className="text-muted-foreground text-sm">Direct</span>}
                  </TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatINR(o.amountPaise)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages} · {data.total} orders</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <OrderDetailPanel id={selected} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function OrderDetailPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api<OrderDetail>(`/admin/orders/${id}`) });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin", "order", id] }), qc.invalidateQueries({ queryKey: ["admin", "orders"] })]);

  const refund = useMutation({
    mutationFn: () =>
      api(`/admin/orders/${id}/refund`, { method: "POST", body: { reason, amountPaise: amount.trim() ? rupeesToPaise(amount.trim()) : undefined } }),
    onSuccess: async () => {
      toast.success("Refund issued through Razorpay");
      setAmount("");
      setReason("");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reconcile = useMutation({
    mutationFn: () => api<{ result: string }>(`/admin/orders/${id}/reconcile`, { method: "POST" }),
    onSuccess: async (r) => {
      toast[r.result === "fulfilled" ? "success" : "info"](r.result === "fulfilled" ? "Payment found — order fulfilled" : "No captured payment found at Razorpay");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isPending || !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  const { order, events, commission } = data;
  const refundable = order.amountPaise - order.refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amountPaise, 0);
  const amountValid = !amount.trim() || /^\d+(\.\d{1,2})?$/.test(amount.trim());

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono">{order.orderNumber}</SheetTitle>
        <SheetDescription>{dateFmt.format(new Date(order.createdAt))}</SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6 text-sm">
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd><OrderStatusBadge status={order.status} /></dd>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>{order.customer.name}<div className="text-muted-foreground">{order.customer.email}</div></dd>
          <dt className="text-muted-foreground">eBook</dt>
          <dd>{order.product.title}</dd>
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="tabular-nums">{formatINR(order.amountPaise)}{order.refundedPaise > 0 && ` (−${formatINR(order.refundedPaise)} refunded)`}</dd>
          <dt className="text-muted-foreground">Razorpay order</dt>
          <dd className="font-mono text-xs break-all">{order.razorpay.orderId}</dd>
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="font-mono text-xs break-all">{order.razorpay.paymentId ?? "—"}{order.razorpay.method ? ` · ${order.razorpay.method}` : ""}</dd>
          <dt className="text-muted-foreground">Attribution</dt>
          <dd>{order.attribution.type === "affiliate" ? `Affiliate ${order.attribution.affiliateCode}` : "Direct"}</dd>
          {commission && (
            <>
              <dt className="text-muted-foreground">Commission</dt>
              <dd>
                {formatINR(commission.amountPaise)} · <span className="capitalize">{commission.status}</span>
                {commission.clawbackRequired && <Badge variant="destructive" className="ml-2">Clawback needed</Badge>}
              </dd>
            </>
          )}
          {order.failureReason && (
            <>
              <dt className="text-muted-foreground">Failure</dt>
              <dd>{order.failureReason}</dd>
            </>
          )}
        </dl>

        {order.refunds.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-medium">Refunds</h3>
            <ul className="divide-y rounded-lg border">
              {order.refunds.map((r) => (
                <li key={r.refundId} className="flex justify-between px-3 py-2">
                  <span className="font-mono text-xs">{r.refundId}</span>
                  <span>{formatINR(r.amountPaise)} · <span className="capitalize">{r.status}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(order.status === "paid" || order.status === "partially_refunded") && refundable > 0 && (
          <section className="space-y-3 rounded-lg border p-3">
            <h3 className="font-medium">Issue a refund</h3>
            <Field>
              <FieldLabel htmlFor="refund-amount">Amount (₹)</FieldLabel>
              <Input id="refund-amount" inputMode="decimal" placeholder={`Full: ${(refundable / 100).toFixed(2)}`} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!amountValid} />
              <FieldDescription>Leave empty for a full refund. A full refund removes the book from the customer&apos;s library and reverses any commission.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
              <Textarea id="refund-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button variant="destructive" disabled={refund.isPending || reason.trim().length < 3 || !amountValid} onClick={() => refund.mutate()}>
              {refund.isPending ? <Spinner /> : <Undo2 />} Refund via Razorpay
            </Button>
          </section>
        )}

        {(order.status === "created" || order.status === "failed") && (
          <section className="space-y-2 rounded-lg border p-3">
            <h3 className="font-medium">Check with Razorpay</h3>
            <p className="text-muted-foreground">If the customer says they paid, this looks up the order at Razorpay and fulfils it if a matching captured payment exists.</p>
            <Button variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>
              {reconcile.isPending ? <Spinner /> : <RefreshCw />} Reconcile payment
            </Button>
          </section>
        )}

        {events.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-medium">Webhook events</h3>
            <ul className="divide-y rounded-lg border">
              {events.map((e) => (
                <li key={e.eventId} className="px-3 py-2">
                  <div className="flex justify-between"><span>{e.type}</span><span className="text-muted-foreground capitalize">{e.status}</span></div>
                  <div className="text-muted-foreground text-xs">{dateFmt.format(new Date(e.createdAt))}{e.error ? ` · ${e.error}` : ""}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
