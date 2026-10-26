"use client";

import Link from "next/link";
import { Sparkles, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProductSummary } from "@ebook/shared";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import { displayCombo } from "@/lib/region";
import { useInternational } from "@/lib/region-client";
import { cn } from "@/lib/utils";

/** "in 23 h 10 min", refreshed every minute; null once the offer has ended. */
export function useTimeLeft(expiresAt: string | null): string | null {
  const t = useMessages().checkout.offers;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  if (ms <= 60_000) return t.endsSoon;
  const minutes = Math.floor(ms / 60_000);
  return t.endsIn(Math.floor(minutes / 60), minutes % 60);
}

/**
 * Same-category books at their combo price for 24 hours after a purchase. `fromOrder` lets a
 * guest's checkout show the combo price before they type their email again.
 */
export function ComboOffers({
  items,
  expiresAt,
  fromOrder,
  compact = false,
}: {
  items: ProductSummary[];
  expiresAt: string | null;
  fromOrder?: string;
  /** One column, for narrow pages such as the order confirmation. */
  compact?: boolean;
}) {
  const t = useMessages().checkout.offers;
  const tc = useMessages().common;
  const left = useTimeLeft(expiresAt);
  const international = useInternational();
  if (!items.length || !left) return null;

  return (
    <section className="from-accent via-card to-card relative overflow-hidden rounded-3xl border bg-linear-to-br p-5 sm:p-6" aria-labelledby="combo-offers">
      <div aria-hidden className="bg-gradient-brand absolute inset-x-0 top-0 h-1" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="size-3.5" aria-hidden /> {t.eyebrow}
          </p>
          <h2 id="combo-offers" className="mt-1 text-lg font-semibold tracking-tight">
            {t.title}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{t.body(left)}</p>
        </div>
        <span className="bg-warning/12 text-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums">
          <Timer className="size-3.5" aria-hidden /> {left}
        </span>
      </div>

      <ul className={cn("mt-5 grid gap-3", !compact && "sm:grid-cols-2 lg:grid-cols-3")}>
        {items.map((p) => {
          const combo = displayCombo(p, international);
          if (!combo) return null;
          return (
            <li key={p.id} className="bg-card flex gap-3 rounded-2xl border p-3">
              <BookCover src={p.coverUrl} title={p.title} alt={tc.book.coverOf(p.title)} className="w-14 shrink-0" sizes="56px" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm leading-snug font-medium">{p.title}</p>
                <p className="mt-1 text-sm tabular-nums">
                  <span className="font-semibold">{combo.price}</span>{" "}
                  <span className="text-muted-foreground text-xs line-through">{combo.list}</span>
                </p>
                <Button asChild size="sm" className="mt-auto w-fit rounded-full">
                  <Link href={`/checkout/${p.slug}${fromOrder ? `?from=${encodeURIComponent(fromOrder)}` : ""}`}>{t.cta(combo.price)}</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
