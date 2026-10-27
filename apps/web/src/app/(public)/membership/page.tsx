import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarPlus, Check, CreditCard, Library, Sparkles, Ticket } from "lucide-react";
import { formatINR, formatUSD, type MembershipPlan } from "@ebook/shared";
import { Price } from "@/components/products/price";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";
import { isInternationalVisitor } from "@/lib/region-server";
import { getMembership } from "@/lib/server-api";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).membership;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/membership" } };
}

const STEP_ICONS = [CreditCard, Library, CalendarPlus];

export default async function MembershipPage() {
  const [messages, overview, international] = await Promise.all([getMessages(), getMembership(), isInternationalVisitor()]);
  const t = messages.membership;
  const plans = overview?.plans ?? [];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <div aria-hidden className="bg-primary/15 absolute -top-32 left-1/2 -z-10 h-80 w-160 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 mx-auto max-w-3xl space-y-6 px-4 py-16 text-center motion-safe:duration-500 sm:px-6 sm:py-20">
          <span className="bg-background/70 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase shadow-sm backdrop-blur">
            <Ticket className="size-3.5" aria-hidden /> {t.eyebrow}
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t.titleBefore} <span className="font-display text-gradient-brand pr-1 font-normal italic">{t.titleAccent}</span> {t.titleAfter}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-lg text-pretty">{t.subtitle}</p>
          {overview && overview.bookCount > 0 ? (
            <p className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium">
              <BookOpen className="text-primary size-4" aria-hidden /> {t.booksIncluded(overview.bookCount)}
            </p>
          ) : null}
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6" aria-label={t.eyebrow}>
        {plans.length === 0 ? (
          <div className="bg-card mx-auto max-w-lg rounded-3xl border border-dashed p-10 text-center">
            <h2 className="text-xl font-semibold tracking-tight">{t.comingSoon}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{t.comingSoonBody}</p>
            <Button asChild className="mt-6">
              <Link href="/ebooks">
                {t.browse} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <div className={cn("mx-auto grid gap-6", plans.length === 1 ? "max-w-md" : plans.length === 2 ? "max-w-3xl md:grid-cols-2" : "md:grid-cols-3")}>
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} international={international} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight">{t.howTitle}</h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {t.how.map(({ title, body }, i) => {
              const Icon = STEP_ICONS[i] ?? CreditCard;
              return (
                <li key={title} className="space-y-3 text-center">
                  <span className="bg-gradient-brand mx-auto flex size-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-900/15">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-relaxed">{body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Books */}
      {overview && overview.books.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">{t.booksTitle}</h2>
            <Link href="/ebooks" className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
              {t.allBooks} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ProductGrid products={overview.books.slice(0, 8)} />
        </section>
      ) : null}

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">{t.faqTitle}</h2>
        <div className="divide-y rounded-2xl border">
          {t.faq.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  {q}
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function PlanCard({ plan, international, t }: { plan: MembershipPlan; international: boolean; t: Awaited<ReturnType<typeof getMessages>>["membership"] }) {
  const usd = international && plan.intlPriceCents != null;
  const perDayMinor = Math.max(1, Math.round((usd ? plan.intlPriceCents! : plan.effectivePricePaise) / plan.durationDays));
  const perDay = usd ? formatUSD(perDayMinor) : formatINR(perDayMinor);
  return (
    <div
      className={cn(
        "bg-card relative flex flex-col rounded-3xl border p-6 shadow-sm sm:p-7",
        plan.featured && "border-primary ring-primary/20 shadow-xl shadow-indigo-900/10 ring-2",
      )}
    >
      {plan.featured && (
        <span className="bg-gradient-brand absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-md">
          <Sparkles className="size-3.5" aria-hidden /> {t.bestValue}
        </span>
      )}
      <h2 className="text-lg font-semibold tracking-tight">{plan.title}</h2>
      <p className="text-muted-foreground text-sm">{t.days(plan.durationDays)}</p>
      <Price
        size="lg"
        className="mt-4"
        pricePaise={plan.pricePaise}
        effectivePricePaise={plan.effectivePricePaise}
        discountPercent={plan.discountPercent}
        intlPriceCents={plan.intlPriceCents}
      />
      {plan.durationDays > 1 ? <p className="text-muted-foreground mt-1 text-xs">{t.perDay(perDay)}</p> : null}
      {plan.description ? <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{plan.description}</p> : null}
      {plan.benefits.length > 0 && (
        <ul className="mt-4 space-y-2">
          {plan.benefits.map((b) => (
            <li key={b} className="flex gap-2 text-sm">
              <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-6">
        <Button asChild size="lg" variant={plan.featured ? "default" : "outline"} className="h-12 w-full rounded-full text-base">
          <Link href={`/checkout/${plan.slug}`}>
            {t.choose} <ArrowRight aria-hidden />
          </Link>
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-xs">{t.noRenewal}</p>
      </div>
    </div>
  );
}
