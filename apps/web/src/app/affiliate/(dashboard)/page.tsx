"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, MousePointerClick, Percent, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { formatINR } from "@ebook/shared";
import { AffiliateGate } from "@/components/affiliate/affiliate-gate";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMISSION_STATUS_INFO, type AffiliateStats } from "@/lib/affiliate";
import { api } from "@/lib/api";

export default function AffiliateOverviewPage() {
  return (
    <>
      <PageHeader title="Affiliate overview" description="Clicks, verified sales and earnings from your referral links." />
      <AffiliateGate>{() => <Overview />}</AffiliateGate>
    </>
  );
}

function Overview() {
  const [days, setDays] = useState(30);
  const { data, isPending } = useQuery({
    queryKey: ["affiliate", "stats", days],
    queryFn: () => api<AffiliateStats>(`/affiliate/stats?days=${days}`),
  });
  const e = data?.earnings;
  const lifetime = e ? e.pending.amountPaise + e.approved.amountPaise + e.payable.amountPaise + e.processing.amountPaise + e.paid.amountPaise : 0;

  return (
    <div className="space-y-6">
      <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
        <TabsList>
          <TabsTrigger value="7">7 days</TabsTrigger>
          <TabsTrigger value="30">30 days</TabsTrigger>
          <TabsTrigger value="90">90 days</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Clicks" icon={MousePointerClick} loading={isPending} value={data?.clicks.toLocaleString("en-IN")} hint={data ? `${data.uniqueVisitors} unique visitors` : undefined} />
        <StatTile label="Verified sales" icon={ShoppingBag} loading={isPending} value={data?.sales.toLocaleString("en-IN")} />
        <StatTile label="Conversion" icon={Percent} loading={isPending} value={data ? `${data.conversionRate}%` : undefined} hint="Sales ÷ unique visitors" />
        <StatTile label="Lifetime earnings" icon={HandCoins} loading={isPending} value={formatINR(lifetime)} hint="Excludes reversed commissions" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Clicks per day</CardTitle>
            <CardDescription>Clicks alone never earn commission — only verified sales do.</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ColumnChart
                label="Clicks per day"
                format={(v) => Math.round(v).toLocaleString("en-IN")}
                data={data.series.map((s) => ({ label: s.date, value: s.clicks, detail: s.sales ? `${s.sales} sale${s.sales > 1 ? "s" : ""}` : undefined }))}
              />
            ) : (
              <div className="bg-muted h-48 animate-pulse rounded-lg" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings by status</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(["pending", "approved", "payable", "processing", "paid", "reversed"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {COMMISSION_STATUS_INFO[s].label}
                    <span className="text-muted-foreground block text-xs">{COMMISSION_STATUS_INFO[s].help}</span>
                  </span>
                  <span className="font-medium tabular-nums">{e ? formatINR(e[s].amountPaise) : "—"}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/affiliate/payouts">Request a payout</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance by eBook</CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>eBook</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.sales}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.earnedPaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No links yet.{" "}
              <Link href="/affiliate/products" className="text-primary hover:underline">
                Create your first referral link
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
