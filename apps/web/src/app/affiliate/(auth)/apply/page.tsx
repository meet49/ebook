import type { Metadata } from "next";
import Link from "next/link";
import { BadgeIndianRupee, BarChart3, Link2, Wallet } from "lucide-react";
import { AffiliateApplyForm } from "@/components/affiliate/apply-form";
import { Logo } from "@/components/brand/logo";
import { PreferenceControls } from "@/components/layout/preferences";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).affiliate.apply.metaTitle };
}

const BENEFIT_ICONS = [Link2, BadgeIndianRupee, Wallet, BarChart3];

export default async function AffiliateApplyPage() {
  const t = (await getMessages()).affiliate.apply;
  return (
    <div className="bg-muted/40 dark:bg-background relative flex min-h-screen flex-col overflow-x-clip">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-130" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/affiliates" className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:inline">
            {t.programDetails}
          </Link>
          <PreferenceControls />
        </div>
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-14">
        <section className="space-y-6 lg:sticky lg:top-10 lg:self-start lg:pt-6">
          <Badge variant="secondary" className="w-fit">
            {t.badge}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.pitchTitle}{" "}
            <span className="font-display text-gradient-brand font-normal italic">{t.pitchAccent}</span>
          </h1>
          <p className="text-muted-foreground max-w-lg text-base">{t.pitchBody}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
              return (
                <li key={b.title} className="bg-card/80 flex gap-3 rounded-2xl border p-4 backdrop-blur">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-muted-foreground text-sm">{b.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Card className="h-fit rounded-2xl shadow-lg shadow-black/5 dark:shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl tracking-tight sm:text-2xl">
              <h2>{t.title}</h2>
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <AffiliateApplyForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
