"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, IndianRupee, Receipt, Undo2, Users, UsersRound, Wallet } from "lucide-react";
import { useState } from "react";
import { formatINR, type CommissionStatus } from "@ebook/shared";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function AdminOverviewPage() {
  const { data: me } = useMe();
  const [days, setDays] = useState(30);
  const { data, isPending } = useQuery({ queryKey: ["admin", "stats", days], queryFn: () => api<AdminStats>(`/admin/stats?days=${days}`) });

  const owed = data ? (data.commissions.pending ?? 0) + (data.commissions.approved ?? 0) + (data.commissions.payable ?? 0) + (data.commissions.processing ?? 0) : 0;
  const actions = data
    ? [
        data.affiliates.pending > 0 && { href: "/admin/affiliates", text: `${data.affiliates.pending} affiliate application${data.affiliates.pending > 1 ? "s" : ""} to review` },
        data.openPayouts > 0 && { href: "/admin/payouts", text: `${data.openPayouts} payout request${data.openPayouts > 1 ? "s" : ""} waiting` },
        (data.commissions.pending ?? 0) > 0 && { href: "/admin/commissions", text: `${formatINR(data.commissions.pending ?? 0)} in pending commissions to review` },
        !data.products.published && { href: "/admin/products", text: "No published eBooks yet — publish your first title" },
      ].filter(Boolean) as { href: string; text: string }[]
    : [];

  return (
    <>
      <PageHeader title={`Welcome${me ? `, ${me.name.split(" ")[0]}` : ""}`} description="Sales, customers and affiliate activity." />
      <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))} className="mb-4">
        <TabsList>
          <TabsTrigger value="7">7 days</TabsTrigger>
          <TabsTrigger value="30">30 days</TabsTrigger>
          <TabsTrigger value="90">90 days</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Net revenue" icon={IndianRupee} loading={isPending} value={data ? formatINR(data.revenue.netPaise) : undefined} hint={data ? `${formatINR(data.revenue.grossPaise)} gross` : undefined} />
        <StatTile label="Orders" icon={Receipt} loading={isPending} value={data?.revenue.orders.toLocaleString("en-IN")} hint={data ? `${data.revenue.affiliateOrders} via affiliates` : undefined} />
        <StatTile label="Refunds" icon={Undo2} loading={isPending} value={data ? formatINR(data.revenue.refundedPaise) : undefined} />
        <StatTile label="Commission owed" icon={Wallet} loading={isPending} value={data ? formatINR(owed) : undefined} hint={data ? `${formatINR(data.commissions.paid ?? 0)} paid out` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Net revenue per day</CardTitle>
            <CardDescription>After refunds, by payment date (IST)</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ColumnChart
                label="Net revenue per day"
                format={compactINR}
                data={data.series.map((s) => ({ label: s.date, value: s.revenuePaise, detail: s.orders ? `${s.orders} order${s.orders > 1 ? "s" : ""}` : undefined }))}
              />
            ) : (
              <div className="bg-muted h-48 animate-pulse rounded-lg" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length ? (
                <ul className="space-y-2">
                  {actions.map((a) => (
                    <li key={a.href + a.text}>
                      <Link href={a.href} className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                        <AlertCircle className="text-warning size-4 shrink-0" aria-hidden /> {a.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">{isPending ? "Loading…" : "All caught up."}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top eBooks</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.topProducts.length ? (
                <ol className="space-y-2 text-sm">
                  {data.topProducts.map((p) => (
                    <li key={p.productId} className="flex justify-between gap-3">
                      <span className="truncate">{p.title}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">{p.orders} · {formatINR(p.revenuePaise)}</span>
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Customers" icon={Users} loading={isPending} value={data?.customers.toLocaleString("en-IN")} />
        <StatTile label="Active affiliates" icon={UsersRound} loading={isPending} value={data?.affiliates.approved.toLocaleString("en-IN")} />
        <StatTile label="Published eBooks" icon={BookOpen} loading={isPending} value={(data?.products.published ?? 0).toLocaleString("en-IN")} hint={data ? `${data.products.draft ?? 0} drafts` : undefined} />
      </div>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/admin/products/new">Add a new eBook</Link>
        </Button>
      </div>
    </>
  );
}
