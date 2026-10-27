import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, BookOpenCheck, CreditCard, Fingerprint, Megaphone, MonitorSmartphone, PenLine, ScanSearch, Upload, Wallet } from "lucide-react";
import { AuthorEarningsCalculator } from "@/components/authors/author-earnings-calculator";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).author.landing;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/authors" } };
}

const STEP_ICONS = [PenLine, Upload, ScanSearch, BadgeIndianRupee];
const FEATURE_ICONS = [Fingerprint, CreditCard, Megaphone, Wallet, BookOpenCheck, MonitorSmartphone];

export default async function AuthorsLandingPage() {
  const t = (await getMessages()).author.landing;

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="bg-primary/15 absolute -top-32 left-1/2 -z-10 h-80 w-160 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 mx-auto max-w-3xl space-y-6 px-4 py-16 text-center motion-safe:duration-500 sm:px-6 sm:py-24">
          <span className="bg-background/70 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm backdrop-blur">
            <PenLine className="size-3.5" aria-hidden /> {t.badge}
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t.titleStart} <span className="font-display text-gradient-brand pr-1 font-normal italic">{t.titleAccent}</span> {t.titleEnd}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-lg text-pretty">{t.subtitle}</p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base shadow-lg shadow-indigo-900/15">
              <Link href="/author/apply">
                {t.apply} <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70 h-12 rounded-full px-7 text-base">
              <Link href="/author/login">{t.signIn}</Link>
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
        <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <div aria-hidden className="via-primary/40 absolute top-7 right-[12%] left-[12%] hidden h-px bg-linear-to-r from-transparent to-transparent lg:block" />
          {t.steps.map(({ title, body }, i) => {
            const Icon = STEP_ICONS[i] ?? PenLine;
            return (
              <li key={title} className="relative flex flex-col items-center text-center">
                <span className="bg-background ring-primary/15 relative flex size-14 items-center justify-center rounded-2xl border shadow-sm ring-4">
                  <Icon className="text-primary size-6" aria-hidden />
                  <span className="bg-gradient-brand absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">{body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* What you get */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.featuresEyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.featuresTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? BookOpenCheck;
              return (
                <div key={f.title} className="bg-card group rounded-3xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <span className="bg-primary/10 text-primary group-hover:bg-gradient-brand flex size-11 items-center justify-center rounded-xl transition-colors group-hover:text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Earnings */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 -left-20 -z-10 size-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <BadgeIndianRupee className="size-3.5" aria-hidden /> {t.calcEyebrow}
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.calcTitle}</h2>
              <p className="max-w-lg text-white/80">{t.calcBody}</p>
              <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-6 dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90">
                <Link href="/author/apply">
                  {t.apply} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <AuthorEarningsCalculator />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">{t.faqTitle}</h2>
        <div className="space-y-3">
          {t.faq.map((f) => (
            <details key={f.q} className="group bg-card rounded-2xl border px-5 py-4 transition-shadow open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden">
                {f.q}
                <span
                  className="bg-muted text-muted-foreground group-open:bg-primary group-open:text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full transition-all group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden border-t">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{t.ctaTitle}</h2>
          <p className="text-muted-foreground max-w-xl">{t.ctaBody}</p>
          <Button asChild size="lg" className="shadow-primary/25 h-12 rounded-full px-7 text-base shadow-lg">
            <Link href="/author/apply">
              {t.apply} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
