"use client";

import Link from "next/link";
import { ArrowRight, Check, Copy, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatINR, type FeaturedOffer } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import { COUPON_COOKIE } from "@/lib/coupon";
import { cn } from "@/lib/utils";

/** Countdowns only make sense for offers ending soon. */
const COUNTDOWN_WINDOW_MS = 10 * 86_400_000;

function useCountdown(endsAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const end = new Date(endsAt).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (left === null || left > COUNTDOWN_WINDOW_MS) return null;
  const s = Math.floor(left / 1000);
  return { d: Math.floor(s / 86_400), h: Math.floor((s % 86_400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * The coupon the admin chose to advertise, as a ticket: the discount on the stub, the code
 * to copy (which also applies it at checkout) and a countdown when it ends soon.
 */
export function OfferBanner({ offer, compact = false }: { offer: FeaturedOffer; compact?: boolean }) {
  const t = useMessages().home.offer;
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(offer.endsAt);
  const discount = offer.type === "percent" ? t.percent(offer.percentOff ?? 0) : t.amount(formatINR(offer.amountOffPaise ?? 0));
  const scope = t.scope[offer.appliesTo] ?? t.scope.books;
  const shopHref = `${offer.appliesTo === "membership" ? "/membership" : "/ebooks"}?coupon=${encodeURIComponent(offer.code)}`;

  const copy = async () => {
    // Remember it for checkout, as a shared ?coupon= link would.
    document.cookie = `${COUPON_COOKIE}=${offer.code}; Max-Age=${7 * 86_400}; path=/; SameSite=Lax`;
    try {
      await navigator.clipboard.writeText(offer.code);
    } catch {
      // The code is still applied at checkout through the cookie.
    }
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className={compact ? "mb-6" : "mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6"} aria-label={t.badge}>
      <div className="bg-card relative isolate flex flex-col overflow-hidden rounded-3xl border shadow-xl shadow-indigo-900/5 md:flex-row">
        {/* Stub: the discount */}
        <div className={cn("bg-gradient-brand relative overflow-hidden text-white md:w-[36%]", compact ? "px-6 py-5" : "px-6 py-6 md:px-8 md:py-8")}>
          <div aria-hidden className="absolute -top-10 -right-10 size-36 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-12 -left-6 size-28 rounded-full bg-white/10" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase">
            <Sparkles className="size-3.5" aria-hidden /> {t.badge}
          </span>
          <p className={cn("relative mt-3 font-semibold tracking-tight", compact ? "text-3xl" : "text-4xl sm:text-5xl")}>{discount}</p>
          <p className="relative mt-1 text-sm text-white/85">{scope}</p>
        </div>

        {/* Perforation between stub and body */}
        <div aria-hidden className="relative hidden w-0 border-l-2 border-dashed md:block">
          <span className="bg-background absolute -top-3 -left-[13px] size-6 rounded-full border" />
          <span className="bg-background absolute -bottom-3 -left-[13px] size-6 rounded-full border" />
        </div>
        <div aria-hidden className="border-t-2 border-dashed md:hidden" />

        {/* Body: the code and the countdown */}
        <div className={cn("flex flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between", compact ? "p-5 md:px-7" : "p-6 md:px-8")}>
          <div className="space-y-2.5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{t.useCode}</p>
            <button
              type="button"
              onClick={copy}
              aria-label={`${t.copy}: ${offer.code}`}
              className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 focus-visible:ring-ring/50 inline-flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-2.5 font-mono text-xl font-semibold tracking-[0.18em] transition-colors outline-none focus-visible:ring-[3px]"
            >
              {offer.code}
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4 opacity-70" aria-hidden />}
            </button>
            {offer.minOrderPaise > 0 ? <p className="text-muted-foreground text-xs">{t.minOrder(formatINR(offer.minOrderPaise))}</p> : null}
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            {countdown && (
              <div className="flex items-center gap-2" aria-label={t.endsIn}>
                <span className="text-muted-foreground mr-1 text-xs font-medium">{t.endsIn}</span>
                {(["d", "h", "m", "s"] as const)
                  .filter((u) => u !== "d" || countdown.d > 0)
                  .map((u) => (
                    <span key={u} className="bg-muted flex min-w-11 flex-col items-center rounded-lg px-2 py-1">
                      <span className="text-sm font-semibold tabular-nums">{String(countdown[u]).padStart(2, "0")}</span>
                      <span className="text-muted-foreground text-[10px]">{t.units[u]}</span>
                    </span>
                  ))}
              </div>
            )}
            <Button asChild className="h-11 rounded-full px-5 shadow-md shadow-indigo-900/10">
              <Link href={shopHref}>
                {t.shop} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
