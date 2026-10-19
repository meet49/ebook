"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Receipt, RefreshCw, Undo2 } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { formatINR, rupeesToPaise, type OrderStatus, type Paginated } from "@ebook/shared";
import { FilterPills, ListCard, SearchField, StatusPill } from "@/components/dashboard/list-ui";
import { OrderStatusBadge } from "@/components/checkout/order-status";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { orderTitle, type AdminOrder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

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

function Source({ order }: { order: AdminOrder }) {
  return order.attribution.type === "affiliate" ? (
    <StatusPill tone="violet">Affiliate {order.attribution.affiliateCode}</StatusPill>
  ) : (
    <span className="text-muted-foreground text-xs">Direct</span>
  );
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
      <PageHeader eyebrow="Store" title="Orders & refunds" description="Verified payments, refunds and payment history. Select an order for details." />

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
            <SearchField
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Order no., email, title, payment ID"
              aria-label="Search orders"
              className="lg:max-w-xs"
            />
          </>
        }
      >
        {isError ? (
          <ListError title="Couldn't load orders" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={6} />
        ) : data.items.length === 0 ? (
          <ListEmpty icon={Receipt} title="No orders" description="Orders appear here once customers check out." />
        ) : (
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            {/* Phones: stacked rows */}
            <ul className="divide-y md:hidden">
              {data.items.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => setSelected(o.id)} className="hover:bg-muted/50 flex w-full items-start gap-3 p-4 text-left transition-colors">
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{o.customer.name}</span>
                          <span className="text-muted-foreground block truncate text-xs">{orderTitle(o)}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatINR(o.amountPaise)}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={o.status} />
                        <Source order={o} />
                      </span>
                      <span className="text-muted-foreground block font-mono text-xs">
                        {o.orderNumber} · <span className="font-sans">{dateFmt.format(new Date(o.createdAt))}</span>
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
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
                      <button
                        type="button"
                        className="focus-visible:ring-ring/50 rounded font-mono text-xs font-medium outline-none hover:underline focus-visible:ring-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(o.id);
                        }}
                      >
                        {o.orderNumber}
                      </button>
                      <div className="text-muted-foreground text-xs">{dateFmt.format(new Date(o.createdAt))}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{o.customer.name}</div>
                      <div className="text-muted-foreground text-xs">{o.customer.email}</div>
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={orderTitle(o)}>
                      {orderTitle(o)}
                    </TableCell>
                    <TableCell>
                      <Source order={o} />
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right font-semibold tabular-nums">{formatINR(o.amountPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} summary={`${data.total} orders`} /> : null}
      </ListCard>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{selected && <OrderDetailPanel id={selected} />}</SheetContent>
      </Sheet>
    </>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border p-4", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
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
        <SheetTitle className="sr-only">Order details</SheetTitle>
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
      <SheetHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="font-mono">{order.orderNumber}</SheetTitle>
          <OrderStatusBadge status={order.status} />
        </div>
        <SheetDescription>{dateFmt.format(new Date(order.createdAt))}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6 text-sm">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-muted-foreground text-xs">Amount</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatINR(order.amountPaise)}</p>
          {order.refundedPaise > 0 && <p className="text-warning text-xs font-medium">−{formatINR(order.refundedPaise)} refunded</p>}
        </div>

        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5">
          <dt className="text-muted-foreground">Customer</dt>
          <dd>
            {order.customer.name}
            <div className="text-muted-foreground break-all">{order.customer.email}</div>
          </dd>
          <dt className="text-muted-foreground">{order.lines.length > 1 ? "eBooks" : "eBook"}</dt>
          <dd className="space-y-1">
            {order.lines.map((l) => (
              <div key={l.slug} className="flex justify-between gap-3">
                <span>
                  {l.title}
                  {l.combo ? <span className="bg-primary/10 text-primary ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase">Combo</span> : null}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">{formatINR(l.pricePaise)}</span>
              </div>
            ))}
          </dd>
          <dt className="text-muted-foreground">Razorpay order</dt>
          <dd className="font-mono text-xs break-all">{order.razorpay.orderId}</dd>
          <dt className="text-muted-foreground">Payment</dt>
          <dd className="font-mono text-xs break-all">
            {order.razorpay.paymentId ?? "—"}
            {order.razorpay.method ? ` · ${order.razorpay.method}` : ""}
          </dd>
          <dt className="text-muted-foreground">Attribution</dt>
          <dd>
            <Source order={order} />
          </dd>
          {commission && (
            <>
              <dt className="text-muted-foreground">Commission</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{formatINR(commission.amountPaise)}</span>
                <Badge variant="outline" className="capitalize">
                  {commission.status}
                </Badge>
                {commission.clawbackRequired && <StatusPill tone="destructive">Clawback needed</StatusPill>}
              </dd>
            </>
          )}
          {order.failureReason && (
            <>
              <dt className="text-muted-foreground">Failure</dt>
              <dd className="text-destructive">{order.failureReason}</dd>
            </>
          )}
        </dl>

        {order.refunds.length > 0 && (
          <Section title="Refunds">
            <ul className="divide-y">
              {order.refunds.map((r) => (
                <li key={r.refundId} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="font-mono text-xs break-all">{r.refundId}</span>
                  <span className="shrink-0">
                    <span className="tabular-nums">{formatINR(r.amountPaise)}</span> · <span className="capitalize">{r.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(order.status === "paid" || order.status === "partially_refunded") && refundable > 0 && (
          <Section title="Issue a refund" className="border-destructive/25 bg-destructive/3">
            <Field>
              <FieldLabel htmlFor="refund-amount">Amount (₹)</FieldLabel>
              <Input
                id="refund-amount"
                inputMode="decimal"
                placeholder={`Full: ${(refundable / 100).toFixed(2)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!amountValid}
              />
              <FieldDescription>Leave empty for a full refund. A full refund removes the book from the customer&apos;s library and reverses any commission.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
              <Textarea id="refund-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button variant="destructive" disabled={refund.isPending || reason.trim().length < 3 || !amountValid} onClick={() => refund.mutate()}>
              {refund.isPending ? <Spinner /> : <Undo2 />} Refund via Razorpay
            </Button>
          </Section>
        )}

        {(order.status === "created" || order.status === "failed") && (
          <Section title="Check with Razorpay">
            <p className="text-muted-foreground">If the customer says they paid, this looks up the order at Razorpay and fulfils it if a matching captured payment exists.</p>
            <Button variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate()}>
              {reconcile.isPending ? <Spinner /> : <RefreshCw />} Reconcile payment
            </Button>
          </Section>
        )}

        {events.length > 0 && (
          <Section title="Webhook events">
            <ol className="space-y-3 border-l pl-4">
              {events.map((e) => (
                <li key={e.eventId} className="relative">
                  <span aria-hidden className="bg-border absolute top-1.5 -left-5.25 size-2.5 rounded-full border-2 border-card" />
                  <div className="flex justify-between gap-3">
                    <span className="font-mono text-xs">{e.type}</span>
                    <span className="text-muted-foreground text-xs capitalize">{e.status}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {dateFmt.format(new Date(e.createdAt))}
                    {e.error ? <span className="text-destructive"> · {e.error}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>
    </>
  );
}
