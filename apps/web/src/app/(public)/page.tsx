import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  CreditCard,
  Download,
  Fingerprint,
  Languages,
  Library,
  Link2,
  MousePointerClick,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  SunMoon,
  Wallet,
} from "lucide-react";
import type { ProductSummary } from "@ebook/shared";
import { EarningsCalculator } from "@/components/home/earnings-calculator";
import { AuthorsSection } from "@/components/home/authors-section";
import { FeaturedEbooks } from "@/components/home/featured-ebooks";
import { Hero } from "@/components/home/hero";
import { OfferBanner } from "@/components/home/offer-banner";
import { PassSection } from "@/components/home/pass-section";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { absoluteUrl, jsonLd, organizationLd } from "@/lib/seo";
import { isInternationalVisitor } from "@/lib/region-server";
import { getCatalog, getCategories, getFeaturedOffer, getMembership } from "@/lib/server-api";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationLd,
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE_NAME,
      url: absoluteUrl("/"),
      publisher: { "@id": organizationLd["@id"] },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/ebooks?q={search_term_string}") },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/** Featured titles first, topped up with the newest ones. */
async function shelfBooks(): Promise<ProductSummary[]> {
  const [featured, newest] = await Promise.all([
    getCatalog({ featured: true, sort: "newest", pageSize: 8 }).catch(() => null),
    getCatalog({ sort: "newest", pageSize: 8 }).catch(() => null),
  ]);
  const seen = new Set<string>();
  return [...(featured?.items ?? []), ...(newest?.items ?? [])].filter((b) => !seen.has(b.id) && seen.add(b.id)).slice(0, 8);
}

const STEP_ICONS = [MousePointerClick, CreditCard, Library];
const APP_ICONS = [Download, Languages, SunMoon];
const AFFILIATE_ICONS = [Link2, RefreshCcw, Wallet];

export default async function HomePage() {
  const [t, books, categories, offer, membership, international] = await Promise.all([
    getMessages(),
    shelfBooks(),
    getCategories().catch(() => []),
    getFeaturedOffer(),
    getMembership(),
    isInternationalVisitor(),
  ]);
  const h = t.home;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteLd) }} />
      <Hero books={books.slice(0, 3)} />

      {offer ? <OfferBanner offer={offer} /> : null}

      <FeaturedEbooks books={books} categories={categories.slice(0, 10)} t={h.shelf} />

      {membership?.plans.length ? <PassSection overview={membership} international={international} t={h.pass} days={t.membership.days} /> : null}

      {/* Feature bento */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{h.features.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {h.features.titleStart} <span className="font-display text-gradient-brand font-normal italic">{h.features.titleAccent}</span>{" "}
            {h.features.titleEnd}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          <div className="from-accent to-card relative overflow-hidden rounded-3xl border bg-linear-to-br p-7 md:col-span-4">
            <span className="bg-gradient-brand flex size-11 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-900/20">
              <BookOpenCheck className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold">{h.features.readerTitle}</h3>
            <p className="text-muted-foreground mt-2 max-w-md">{h.features.readerBody}</p>
            <div aria-hidden className="bg-card absolute -right-6 -bottom-10 hidden h-40 w-64 rotate-[-8deg] rounded-xl border shadow-xl sm:block">
              <div className="flex h-full">
                <div className="flex-1 space-y-2 p-4">
                  {[90, 100, 80, 95, 70].map((w, i) => (
                    <div key={i} className="bg-muted h-1.5 rounded-full" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <div className="bg-border w-px" />
                <div className="flex-1 space-y-2 p-4">
                  {[100, 85, 92, 60].map((w, i) => (
                    <div key={i} className="bg-muted h-1.5 rounded-full" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <Feature className="md:col-span-2" icon={Smartphone} title={h.features.deviceTitle} body={h.features.deviceBody} />
          <Feature className="md:col-span-2" icon={BookMarked} title={h.features.bookmarkTitle} body={h.features.bookmarkBody} />
          <Feature className="md:col-span-2" icon={ShieldCheck} title={h.features.paymentTitle} body={h.features.paymentBody} />
          <Feature className="md:col-span-2" icon={Fingerprint} title={h.features.personalTitle} body={h.features.personalBody} />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{h.steps.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{h.steps.title}</h2>
          </div>
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            <div aria-hidden className="via-primary/40 absolute top-7 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent to-transparent md:block" />
            {h.steps.items.map(({ title, body }, i) => {
              const Icon = STEP_ICONS[i] ?? Library;
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

      {/* Install the app */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <div className="bg-card relative isolate grid items-center gap-10 overflow-hidden rounded-[2rem] border p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
          <div aria-hidden className="absolute -top-32 -right-20 -z-10 size-96 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand-violet)_18%,transparent),transparent)]" />
          <div className="space-y-6">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{h.app.eyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {h.app.titleStart} <span className="font-display text-gradient-brand font-normal italic">{h.app.titleAccent}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl">{h.app.body}</p>
            <ul className="grid gap-4 sm:grid-cols-3">
              {h.app.points.map((p, i) => {
                const Icon = APP_ICONS[i] ?? Download;
                return (
                  <li key={p.title} className="bg-muted/50 rounded-2xl border p-4">
                    <Icon className="text-primary size-5" aria-hidden />
                    <p className="mt-2 text-sm font-semibold">{p.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{p.body}</p>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-3">
              <InstallAppButton variant="default" size="lg" className="shadow-primary/25 h-12 rounded-full px-6 shadow-lg" showWithoutPrompt />
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6">
                <Link href="/library">{h.app.library}</Link>
              </Button>
            </div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* Affiliate */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 -left-20 -z-10 size-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <Link2 className="size-3.5" aria-hidden /> {h.affiliate.badge}
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {h.affiliate.titleStart} <span className="font-display font-normal italic">{h.affiliate.titleAccent}</span> {h.affiliate.titleEnd}
              </h2>
              <ul className="space-y-3 text-white/85">
                {h.affiliate.points.map((text, i) => {
                  const Icon = AFFILIATE_ICONS[i] ?? Link2;
                  return (
                    <li key={text} className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {text}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-6 dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90">
                  <Link href="/affiliate/apply">
                    {h.affiliate.apply} <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/affiliates">{h.affiliate.details}</Link>
                </Button>
              </div>
            </div>
            <EarningsCalculator />
          </div>
        </div>
      </section>

      <AuthorsSection t={h.authors} />

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{h.faq.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{h.faq.title}</h2>
        </div>
        <div className="space-y-3">
          {h.faq.items.map((f) => (
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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {h.cta.titleStart} <span className="font-display text-gradient-brand font-normal italic">{h.cta.titleAccent}</span> {h.cta.titleEnd}
          </h2>
          <p className="text-muted-foreground max-w-xl">{h.cta.body}</p>
          <Button asChild size="lg" className="shadow-primary/25 h-12 rounded-full px-7 text-base shadow-lg">
            <Link href="/ebooks">
              {h.cta.button} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`bg-card group rounded-3xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5 ${className ?? ""}`}>
      <span className="bg-accent text-accent-foreground group-hover:bg-gradient-brand flex size-11 items-center justify-center rounded-xl transition-colors group-hover:text-white">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

/** A phone showing the app icon on a home screen, for the install section. */
function PhoneMockup() {
  return (
    <div aria-hidden className="mx-auto hidden w-56 lg:block">
      <div className="rounded-[2.4rem] border-4 border-neutral-900 bg-neutral-900 p-1.5 shadow-2xl shadow-indigo-950/30 dark:border-neutral-700">
        <div className="relative h-108 overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,oklch(0.55_0.2_277),oklch(0.45_0.24_300))]">
          <div className="mx-auto mt-2 h-5 w-20 rounded-full bg-neutral-900" />
          <div className="grid grid-cols-4 gap-3 px-4 pt-8">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i} className="aspect-square rounded-xl bg-white/20" />
            ))}
            <span className="flex aspect-square flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative icon */}
              <img src="/icons/icon-192.png" alt="" className="size-full rounded-xl shadow-lg ring-2 ring-white/70" />
            </span>
          </div>
          <div className="absolute inset-x-3 bottom-4 rounded-2xl bg-white/90 p-3 text-neutral-900 shadow-lg">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative icon */}
              <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">ReadnShare</p>
                <p className="truncate text-[10px] text-neutral-500">readnshare.in</p>
              </div>
              <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">Open</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
