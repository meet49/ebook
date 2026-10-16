"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  HandCoins,
  IndianRupee,
  Plus,
  Receipt,
  Sparkles,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { formatINR, type CommissionStatus } from "@ebook/shared";
import { FilterPills, IconChip, type PillTone } from "@/components/dashboard/list-ui";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";

interface AdminStats {
  days: number;
  revenue: { grossPaise: number; refundedPaise: number; netPaise: number; orders: number; affiliateOrders: number };
  series: { date: string; revenuePaise: number; orders: number }[];
  topProducts: { productId: string; title: string; orders: number; revenuePaise: number }[];
  customers: number;
  affiliates: { approved: number; pending: number };
  commissions: Partial<Record<CommissionStatus, number>>;
  openPayouts: number;
  products: Record<string, number>;
}

/** Axis/tooltip formatting: whole rupees, compact for big numbers. */
function compactINR(paise: number): string {
  const rupees = paise / 100;
  return rupees >= 100_000 ? `₹${(rupees / 100_000).toFixed(1)}L` : rupees >= 1000 ? `₹${(rupees / 1000).toFixed(1)}k` : `₹${Math.round(rupees)}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function AdminOverviewPage() {
  const { data: me } = useMe();
  const [days, setDays] = useState(30);
  const { data, isPending } = useQuery({ queryKey: ["admin", "stats", days], queryFn: () => api<AdminStats>(`/admin/stats?days=${days}`) });

  const owed = data ? (data.commissions.pending ?? 0) + (data.commissions.approved ?? 0) + (data.commissions.payable ?? 0) + (data.commissions.processing ?? 0) : 0;
  const actions: { href: string; text: string; icon: LucideIcon; tone: PillTone }[] = [];
  if (data) {
    if (data.affiliates.pending > 0)
      actions.push({ href: "/admin/affiliates", text: `${plural(data.affiliates.pending, "affiliate application")} to review`, icon: UsersRound, tone: "violet" });
    if (data.openPayouts > 0) actions.push({ href: "/admin/payouts", text: `${plural(data.openPayouts, "payout request")} waiting`, icon: Wallet, tone: "warning" });
    if ((data.commissions.pending ?? 0) > 0)
      actions.push({ href: "/admin/commissions", text: `${formatINR(data.commissions.pending ?? 0)} in pending commissions to review`, icon: HandCoins, tone: "primary" });
    if (!data.products.published) actions.push({ href: "/admin/products", text: "No published eBooks yet — publish your first title", icon: BookOpen, tone: "success" });
  }
  const firstName = me?.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <section className="bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-8">
        <div aria-hidden className="bg-gradient-brand pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.15]" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-brand-violet/20 pointer-events-none absolute -top-24 -right-20 size-72 rounded-full blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="size-3.5" aria-hidden /> Store overview
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Welcome
              {firstName ? (
                <>
                  , <span className="font-display text-gradient-brand font-normal italic">{firstName}</span>
                </>
              ) : null}
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm">Sales, customers and affiliate activity at a glance.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/admin/products/new">
                <Plus /> Add a new eBook
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70">
              <Link href="/admin/orders">
                <Receipt /> View orders
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <FilterPills
        label="Time period"
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
        options={["7", "30", "90"].map((d) => ({ value: d, label: `${d} days` }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Net revenue" icon={IndianRupee} tone="success" loading={isPending} value={data ? formatINR(data.revenue.netPaise) : undefined} hint={data ? `${formatINR(data.revenue.grossPaise)} gross` : undefined} />
        <StatTile label="Orders" icon={Receipt} tone="primary" loading={isPending} value={data?.revenue.orders.toLocaleString("en-IN")} hint={data ? `${data.revenue.affiliateOrders} via affiliates` : undefined} />
        <StatTile label="Refunds" icon={Undo2} tone="warning" loading={isPending} value={data ? formatINR(data.revenue.refundedPaise) : undefined} />
        <StatTile label="Commission owed" icon={Wallet} tone="violet" loading={isPending} value={data ? formatINR(owed) : undefined} hint={data ? `${formatINR(data.commissions.paid ?? 0)} paid out` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Net revenue per day</CardTitle>
            <CardDescription>After refunds, by payment date (IST)</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ColumnChart
                label="Net revenue per day"
                format={compactINR}
                data={data.series.map((s) => ({ label: s.date, value: s.revenuePaise, detail: s.orders ? plural(s.orders, "order") : undefined }))}
              />
            ) : (
              <Skeleton className="h-52 rounded-lg" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : actions.length ? (
                <ul className="space-y-2">
                  {actions.map((a) => (
                    <li key={a.href + a.text}>
                      <Link
                        href={a.href}
                        className="hover:bg-muted/70 focus-visible:ring-ring/50 group flex items-center gap-3 rounded-xl border p-2.5 text-sm transition-colors outline-none focus-visible:ring-3"
                      >
                        <IconChip icon={a.icon} tone={a.tone} />
                        <span className="min-w-0 flex-1 font-medium">{a.text}</span>
                        <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Sparkles className="text-success size-4" aria-hidden /> All caught up.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Top eBooks</CardTitle>
              <CardDescription>In the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : data?.topProducts.length ? (
                <ol className="space-y-1">
                  {data.topProducts.map((p, i) => (
                    <li key={p.productId} className="flex items-center gap-3 rounded-lg py-1.5">
                      <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="text-muted-foreground block text-xs">{plural(p.orders, "order")}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(p.revenuePaise)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">No sales in this period.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Customers" icon={Users} tone="primary" loading={isPending} value={data?.customers.toLocaleString("en-IN")} />
        <StatTile label="Active affiliates" icon={UsersRound} tone="violet" loading={isPending} value={data?.affiliates.approved.toLocaleString("en-IN")} />
        <StatTile
          label="Published eBooks"
          icon={BookOpen}
          tone="success"
          loading={isPending}
          value={(data?.products.published ?? 0).toLocaleString("en-IN")}
          hint={data ? plural(data.products.draft ?? 0, "draft") : undefined}
        />
      </div>
    </div>
  );
}
