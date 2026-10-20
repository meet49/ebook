import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Mail, MapPin, MessageCircleQuestion, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { BUSINESS, SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";
import { CopyEmailButton } from "./copy-email";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).contact;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const all = await getMessages();
  const t = all.contact;
  const f = all.common.footer;
  const orderMail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${t.orderSubject} — ${SITE_NAME}`)}`;

  return (
    <div className="relative isolate">
      <div aria-hidden className="bg-grid absolute inset-x-0 top-0 -z-10 h-96" />
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-96 w-175 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]" />

      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.titleStart} <span className="font-display text-gradient-brand font-normal italic">{t.titleAccent}</span>
            {t.titleEnd}
          </h1>
          <p className="text-muted-foreground mt-4 text-lg text-pretty">{t.subtitle}</p>
        </header>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <section className="bg-card relative overflow-hidden rounded-3xl border p-6 sm:p-8" aria-labelledby="contact-email">
            <div aria-hidden className="bg-gradient-brand absolute inset-x-0 top-0 h-1" />
            <span className="bg-gradient-brand flex size-12 items-center justify-center rounded-2xl text-white shadow-md shadow-indigo-900/20">
              <Mail className="size-5" aria-hidden />
            </span>
            <h2 id="contact-email" className="mt-5 text-xl font-semibold">
              {t.emailLabel}
            </h2>
            <p className="text-muted-foreground mt-1">{t.emailBody}</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary mt-5 block text-lg font-semibold break-all hover:underline sm:text-xl">
              {SUPPORT_EMAIL}
            </a>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-full">
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Mail /> {t.emailButton}
                </a>
              </Button>
              <CopyEmailButton email={SUPPORT_EMAIL} label={t.copy} copiedLabel={t.copied} />
            </div>
          </section>

          <section className="bg-card rounded-3xl border p-6 sm:p-8" aria-labelledby="contact-order">
            <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-2xl">
              <ClipboardList className="size-5" aria-hidden />
            </span>
            <h2 id="contact-order" className="mt-5 text-xl font-semibold">
              {t.orderTitle}
            </h2>
            <p className="text-muted-foreground mt-1">{t.orderBody}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {t.orderPoints.map((p, i) => (
                <li key={p} className="flex gap-3">
                  <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
                  <span className="pt-0.5">{p}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <a href={orderMail}>
                {t.emailButton} <ArrowRight />
              </a>
            </Button>
          </section>
        </div>

        {(BUSINESS.legalName || BUSINESS.address || BUSINESS.phone) && (
          <section className="bg-card mt-5 rounded-3xl border p-6 sm:p-8" aria-labelledby="contact-business">
            <h2 id="contact-business" className="text-xl font-semibold">
              {t.businessTitle}
            </h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {BUSINESS.legalName ? <Detail icon={Building2} label={t.businessName} value={BUSINESS.legalName} /> : null}
              {BUSINESS.address ? <Detail icon={MapPin} label={t.address} value={BUSINESS.address} /> : null}
              {BUSINESS.phone ? (
                <Detail
                  icon={Phone}
                  label={t.phone}
                  value={
                    <a href={`tel:${BUSINESS.phone.replace(/[^d+]/g, "")}`} className="hover:text-primary">
                      {BUSINESS.phone}
                    </a>
                  }
                />
              ) : null}
              <Detail
                icon={Mail}
                label={t.email}
                value={
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary [overflow-wrap:anywhere]">
                    {SUPPORT_EMAIL}
                  </a>
                }
              />
            </dl>
          </section>
        )}

        <section className="mt-14" aria-labelledby="contact-quick">
          <div className="mb-6 flex items-center gap-2">
            <MessageCircleQuestion className="text-primary size-5" aria-hidden />
            <h2 id="contact-quick" className="text-xl font-semibold">
              {t.quickTitle}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.quick.map((item) => (
              <Link
                key={item.q}
                href={item.link}
                className="group bg-card hover:border-primary/40 flex flex-col rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5"
              >
                <h3 className="font-semibold">{item.q}</h3>
                <p className="text-muted-foreground mt-1.5 flex-1 text-sm leading-relaxed">{item.a}</p>
                <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
                  {item.linkLabel}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <nav className="text-muted-foreground mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t pt-8 text-sm" aria-label={t.policies}>
          {[
            { href: "/legal/terms", label: f.terms },
            { href: "/legal/privacy", label: f.privacy },
            { href: "/legal/refunds", label: f.refunds },
            { href: "/legal/delivery", label: f.delivery },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}
