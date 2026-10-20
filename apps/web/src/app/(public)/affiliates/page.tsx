import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock4, LineChart, Link2, Lightbulb, Send, Share2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).affiliateProgram;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/affiliates" } };
}

const STEP_ICONS = [Send, Share2, Wallet];
const FEATURE_ICONS = [Link2, LineChart, Wallet, Clock4];

export default async function AffiliatesPage() {
  const t = (await getMessages()).affiliateProgram;

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="bg-primary/15 absolute -top-32 left-1/2 -z-10 h-80 w-160 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-center sm:px-6 sm:py-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <span className="bg-background/70 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm backdrop-blur">
            <Link2 className="size-3.5" aria-hidden /> {t.eyebrow}
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t.titleBefore} <span className="font-display text-gradient-brand pr-1 font-normal italic">{t.titleAccent}</span> {t.titleAfter}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-lg text-pretty">{t.subtitle}</p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base shadow-lg shadow-indigo-900/15">
              <Link href="/affiliate/apply">
                {t.apply} <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70 h-12 rounded-full px-7 text-base">
              <Link href="/affiliate/login">{t.signIn}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{t.free}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.stepsEyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.stepsTitle}</h2>
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="via-primary/30 absolute top-7 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent to-transparent md:block"
          />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            {t.steps.map(({ title, body }, i) => {
              const Icon = STEP_ICONS[i] ?? Send;
              return (
                <li key={title} className="relative flex flex-col items-center text-center">
                  <span className="bg-background ring-primary/15 relative flex size-14 items-center justify-center rounded-2xl border shadow-sm ring-4">
                    <Icon className="text-primary size-6" aria-hidden />
                    <span className="bg-gradient-brand absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">{body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.featuresEyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.featuresTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.map(({ title, body }, i) => {
              const Icon = FEATURE_ICONS[i] ?? Link2;
              return (
                <div
                  key={title}
                  className="bg-card rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/10"
                >
                  <span className="bg-accent text-primary inline-flex size-11 items-center justify-center rounded-2xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div className="space-y-4">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.rulesEyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.rulesTitle}</h2>
            <div className="from-accent to-card mt-6 rounded-3xl border bg-linear-to-br p-6">
              <p className="text-primary flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4" aria-hidden /> {t.exampleLabel}
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t.example}</p>
            </div>
          </div>
          <ul className="bg-card divide-y rounded-3xl border">
            {t.rules.map((r) => (
              <li key={r} className="flex gap-3 p-5 text-sm leading-relaxed">
                <CheckCircle2 className="text-primary mt-0.5 size-4.5 shrink-0" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="absolute -bottom-24 -left-24 -z-10 size-72 rounded-full bg-white/5 blur-3xl" />
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-lg text-white/80 text-pretty">{t.ctaBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-7 text-base">
              <Link href="/affiliate/apply">
                {t.apply} <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-full border border-white/30 px-7 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/affiliate/login">{t.signIn}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
