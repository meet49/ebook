"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  HandCoins,
  Link2,
  MousePointerClick,
  Percent,
  ShoppingBag,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { formatINR } from "@ebook/shared";
import { AffiliateGate } from "@/components/affiliate/affiliate-gate";
import { FilterPills, IconChip, type PillTone } from "@/components/dashboard/list-ui";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { useAffiliateProfile, type AffiliateProfileDto, type AffiliateStats } from "@/lib/affiliate";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";

const STATUS_ORDER = ["pending", "approved", "payable", "processing", "paid", "reversed"] as const;
const STATUS_DOT: Record<(typeof STATUS_ORDER)[number], string> = {
  pending: "bg-muted-foreground/50",
  approved: "bg-primary",
  payable: "bg-success",
  processing: "bg-warning",
  paid: "bg-success/60",
  reversed: "bg-destructive",
};

export default function AffiliateOverviewPage() {
  return (
    <div className="space-y-6">
      <WelcomeBanner />
      <AffiliateGate>{(profile) => <Overview profile={profile} />}</AffiliateGate>
    </div>
  );
}

function WelcomeBanner() {
  const t = useMessages().affiliate.overview;
  const { data: me } = useMe();
  const { data: profile } = useAffiliateProfile();
  const approved = profile?.status === "approved";
  const firstName = me?.name.split(" ")[0];

  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-8">
      <div aria-hidden className="bg-gradient-brand pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.15]" />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />
      <div aria-hidden className="bg-brand-violet/20 pointer-events-none absolute -top-24 -right-20 size-72 rounded-full blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="size-3.5" aria-hidden /> {t.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t.welcome}
            {firstName ? (
              <>
                , <span className="font-display text-gradient-brand font-normal italic">{firstName}</span>
              </>
            ) : null}
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm">{t.intro}</p>
          {approved ? (
            <p className="bg-background/70 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
              <span className="text-muted-foreground">{t.yourCode}</span>
              <span className="font-mono font-semibold">{profile.code}</span>
            </p>
          ) : null}
        </div>
        {approved ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/affiliate/products">
                <Link2 /> {t.getLinks}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70">
              <Link href="/affiliate/payouts">
                <Wallet /> {t.requestPayout}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Overview({ profile }: { profile: AffiliateProfileDto }) {
  const messages = useMessages();
  const t = messages.affiliate.overview;
  const status = messages.affiliate.status;
  const fmt = useAffiliateFormat();
  const [days, setDays] = useState(30);
  const { data, isPending } = useQuery({
    queryKey: ["affiliate", "stats", days],
    queryFn: () => api<AffiliateStats>(`/affiliate/stats?days=${days}`),
  });
  const e = data?.earnings;
  const lifetime = e ? e.pending.amountPaise + e.approved.amountPaise + e.payable.amountPaise + e.processing.amountPaise + e.paid.amountPaise : 0;

  const attention: { href: string; text: string; icon: LucideIcon; tone: PillTone }[] = [];
  if (e && e.payable.amountPaise > 0) attention.push({ href: "/affiliate/payouts", text: t.attention.payable(formatINR(e.payable.amountPaise)), icon: Wallet, tone: "success" });
  if (!profile.payout) attention.push({ href: "/affiliate/profile", text: t.attention.noPayout, icon: HandCoins, tone: "warning" });
  if (data && data.products.length === 0) attention.push({ href: "/affiliate/products", text: t.attention.noLinks, icon: Link2, tone: "primary" });
  if (e && e.pending.count > 0) attention.push({ href: "/affiliate/commissions", text: t.attention.onHold(e.pending.count), icon: Clock, tone: "muted" });

  return (
    <div className="space-y-6">
      <FilterPills
        label={messages.affiliate.common.periodLabel}
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
        options={["7", "30", "90"].map((d) => ({ value: d, label: messages.affiliate.common.period(Number(d)) }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={t.clicks}
          icon={MousePointerClick}
          tone="primary"
          loading={isPending}
          value={data ? fmt.number(data.clicks) : undefined}
          hint={data ? t.uniqueVisitors(data.uniqueVisitors) : undefined}
        />
        <StatTile label={t.sales} icon={ShoppingBag} tone="violet" loading={isPending} value={data ? fmt.number(data.sales) : undefined} />
        <StatTile label={t.conversion} icon={Percent} tone="warning" loading={isPending} value={data ? `${data.conversionRate}%` : undefined} hint={t.conversionHint} />
        <StatTile label={t.lifetime} icon={HandCoins} tone="success" loading={isPending} value={data ? formatINR(lifetime) : undefined} hint={t.lifetimeHint} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t.chartTitle}</CardTitle>
            <CardDescription>{t.chartNote}</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ColumnChart
                label={t.chartTitle}
                labels={t.chart}
                locale={fmt.locale}
                format={(v) => fmt.number(Math.round(v))}
                data={data.series.map((s) => ({ label: s.date, value: s.clicks, detail: s.sales ? t.salesDetail(s.sales) : undefined }))}
              />
            ) : (
              <Skeleton className="h-52 rounded-lg" />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t.attentionTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : attention.length ? (
              <ul className="space-y-2">
                {attention.map((a) => (
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
                <Sparkles className="text-success size-4" aria-hidden /> {t.allCaughtUp}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t.earningsTitle}</CardTitle>
            <CardDescription>{t.earningsAllTime}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {STATUS_ORDER.map((s) => (
                <li key={s} className={cn("flex items-start justify-between gap-3 py-2.5 text-sm", s === "payable" && "bg-success/5 -mx-2 rounded-lg px-2")}>
                  <span className="flex min-w-0 gap-2.5">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[s])} />
                    <span className="min-w-0">
                      <span className="font-medium">{status[s].label}</span>
                      <span className="text-muted-foreground block text-xs">{status[s].help}</span>
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", s === "reversed" && "text-muted-foreground font-medium")}>
                    {e ? formatINR(e[s].amountPaise) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/affiliate/payouts">
                {t.requestPayout} <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t.topTitle}</CardTitle>
            <CardDescription>{t.topDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data && data.products.length > 0 ? (
              <ol className="space-y-1">
                {data.products.map((p, i) => (
                  <li key={p.productId} className="hover:bg-muted/50 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors">
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="text-muted-foreground block text-xs tabular-nums">{t.productStats(p.clicks, p.sales)}</span>
                    </span>
                    <span className="text-success shrink-0 text-sm font-semibold tabular-nums">{formatINR(p.earnedPaise)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
                <IconChip icon={BookOpen} tone="muted" />
                <p className="text-muted-foreground text-sm">{t.noLinksYet}</p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/affiliate/products">
                    {t.createFirst} <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
