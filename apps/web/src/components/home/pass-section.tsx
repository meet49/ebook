import Link from "next/link";
import { ArrowRight, Check, Sparkles, Ticket } from "lucide-react";
import { formatINR, formatUSD, type MembershipOverview, type MembershipPlan } from "@ebook/shared";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";

/** Fan of covers: rotation, horizontal offset and stacking for up to five books. */
const FAN = [
  { rotate: -14, x: -118, y: 18, z: 1 },
  { rotate: -7, x: -60, y: 6, z: 2 },
  { rotate: 0, x: 0, y: 0, z: 5 },
  { rotate: 7, x: 60, y: 6, z: 3 },
  { rotate: 14, x: 118, y: 18, z: 1 },
];

function planPrice(plan: MembershipPlan, international: boolean) {
  const usd = international && plan.intlPriceCents != null;
  const minor = usd ? plan.intlPriceCents! : plan.effectivePricePaise;
  const format = usd ? formatUSD : formatINR;
  return {
    price: format(minor),
    list: !usd && plan.salePricePaise != null ? formatINR(plan.pricePaise) : null,
    perDay: format(Math.max(1, Math.round(minor / Math.max(1, plan.durationDays)))),
  };
}

/** Home page showcase for the ReadnShare Pass: the plans on one side, the books it opens on the other. */
export function PassSection({
  overview,
  international,
  t,
  days,
}: {
  overview: MembershipOverview;
  international: boolean;
  t: Messages["home"]["pass"];
  days: Messages["membership"]["days"];
}) {
  const covers = overview.books.filter((b) => b.coverUrl).slice(0, 5);
  // Centre the fan on however many covers there are.
  const fan = covers.length >= 5 ? FAN : covers.length >= 3 ? FAN.slice(1, 4) : FAN.slice(2, 2 + covers.length);
  const plans = overview.plans.slice(0, 3);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="pass-heading">
      <div className="bg-card relative isolate grid overflow-hidden rounded-[2rem] border lg:grid-cols-[1.05fr_1fr]">
        <div aria-hidden className="absolute -top-40 -left-24 -z-10 size-96 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]" />

        {/* Copy and plans */}
        <div className="space-y-7 p-6 sm:p-10 lg:p-12">
          <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Ticket className="size-3.5" aria-hidden /> {t.badge}
          </span>
          <h2 id="pass-heading" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.titleStart} <span className="font-display text-gradient-brand font-normal italic">{t.titleAccent}</span>
          </h2>
          <p className="text-muted-foreground max-w-lg">{t.body}</p>
          <ul className="space-y-2.5">
            {t.points.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm">
                <span className="bg-success/12 text-success flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className={cn("grid gap-3", plans.length > 1 && "sm:grid-cols-2")}>
            {plans.map((plan) => {
              const price = planPrice(plan, international);
              return (
                <Link
                  key={plan.id}
                  href={`/checkout/${plan.slug}`}
                  className={cn(
                    "group bg-background relative rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
                    plan.featured ? "border-primary ring-primary/15 ring-2" : "hover:border-primary/40",
                  )}
                >
                  {plan.featured && (
                    <span className="bg-gradient-brand absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                      <Sparkles className="size-3" aria-hidden /> {t.bestValue}
                    </span>
                  )}
                  <p className="text-sm font-semibold">{plan.title}</p>
                  <p className="text-muted-foreground text-xs">{days(plan.durationDays)}</p>
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">{price.price}</span>
                    {price.list ? <span className="text-muted-foreground text-xs line-through">{price.list}</span> : null}
                  </p>
                  {plan.durationDays > 1 ? <p className="text-muted-foreground text-xs">{t.perDay(price.perDay)}</p> : null}
                  <ArrowRight className="text-primary absolute right-4 bottom-4 size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              );
            })}
          </div>

          <Button asChild size="lg" className="shadow-primary/25 h-12 rounded-full px-6 shadow-lg">
            <Link href="/membership">
              {t.cta} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        {/* The books it opens */}
        <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] px-6 py-14">
          <div aria-hidden className="bg-grid absolute inset-0 opacity-20" />
          <div aria-hidden className="absolute -right-16 -bottom-20 size-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="relative h-64 w-full max-w-sm" aria-hidden>
            {covers.map((b, i) => {
              const f = fan[i]!;
              return (
                <div
                  key={b.id}
                  className="absolute top-0 left-1/2 w-32 transition-transform duration-500 sm:w-36"
                  style={{ transform: `translateX(calc(-50% + ${f.x}px)) translateY(${f.y}px) rotate(${f.rotate}deg)`, zIndex: f.z }}
                >
                  <BookCover src={b.coverUrl} title={b.title} alt="" sizes="144px" className="shadow-2xl shadow-black/40" />
                </div>
              );
            })}
          </div>
          {/* The pass itself, floating over the shelf */}
          <div className="absolute bottom-6 left-1/2 z-10 w-[min(20rem,calc(100%-3rem))] -translate-x-1/2 rounded-2xl bg-white/15 p-4 text-white shadow-2xl ring-1 ring-white/25 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700">
                <Ticket className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.badge}</p>
                <p className="text-xs text-white/80">{t.booksIncluded(overview.bookCount)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
