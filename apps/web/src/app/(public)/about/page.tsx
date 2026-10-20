import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Eye, Fingerprint, Megaphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { BUSINESS } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).about;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/about" } };
}

const OFFER_ICONS = [BookOpen, Eye, ShieldCheck, Fingerprint];

export default async function AboutPage() {
  const t = (await getMessages()).about;

  return (
    <div className="relative isolate">
      <div aria-hidden className="bg-grid absolute inset-x-0 top-0 -z-10 h-96" />
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-96 w-175 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />

      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.titleStart} <span className="font-display text-gradient-brand font-normal italic">{t.titleAccent}</span>
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">{t.subtitle}</p>
        </header>

        <section className="bg-card mt-12 rounded-3xl border p-6 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">{t.whatTitle}</h2>
          <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">{t.whatBody}</p>
          {BUSINESS.legalName ? <p className="mt-4 text-sm font-medium">{t.operatedBy(BUSINESS.legalName)}</p> : null}
        </section>

        <section className="mt-12" aria-labelledby="about-offer">
          <h2 id="about-offer" className="text-2xl font-semibold tracking-tight">
            {t.offerTitle}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {t.offer.map((o, i) => {
              const Icon = OFFER_ICONS[i] ?? BookOpen;
              return (
                <div key={o.title} className="bg-card rounded-2xl border p-5">
                  <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{o.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{o.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="from-accent to-card mt-12 flex flex-col gap-5 rounded-3xl border bg-linear-to-br p-6 sm:flex-row sm:items-center sm:p-10">
          <span className="bg-gradient-brand flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md shadow-indigo-900/20">
            <Megaphone className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{t.partnersTitle}</h2>
            <p className="text-muted-foreground mt-1">{t.partnersBody}</p>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full">
            <Link href="/affiliates">
              {t.partnersCta} <ArrowRight />
            </Link>
          </Button>
        </section>

        <section className="mt-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t.contactTitle}</h2>
          <p className="text-muted-foreground mt-2">{t.contactBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full">
              <Link href="/contact">{t.contactCta}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/ebooks">{t.browseCta}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
