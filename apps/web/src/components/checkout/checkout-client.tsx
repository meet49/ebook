"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Fingerprint, MonitorSmartphone, Plus, Sparkles, TicketPercent, Timer, Zap } from "lucide-react";
import { useState } from "react";
import { formatINR, formatMoney, type CheckoutQuote, type ProductDetail, type ProductSummary, type QuoteLine } from "@ebook/shared";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { useTimeLeft } from "@/components/checkout/combo-offers";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { forgetCoupon } from "@/lib/coupon";
import { displayCombo } from "@/lib/region";
import { useInternational } from "@/lib/region-client";
import { cn } from "@/lib/utils";

const MAX_ADD_ONS = 3;

/**
 * Order summary, combo add-ons and payment. Prices always come from the server quote; the
 * order is priced again when it is created.
 */
export function CheckoutClient({
  product,
  initialAddOns,
  fromOrder,
  initialCoupon,
}: {
  product: ProductDetail;
  initialAddOns: string[];
  fromOrder?: string;
  initialCoupon?: string;
}) {
  const messages = useMessages();
  const t = messages.checkout;
  const tc = messages.common;
  const { data: user, isPending: userPending } = useMe();
  const international = useInternational();
  const [addOns, setAddOns] = useState<string[]>(() => initialAddOns.slice(0, MAX_ADD_ONS));
  const [coupon, setCoupon] = useState(initialCoupon ?? "");

  const { data: quote, isPlaceholderData, isFetching } = useQuery({
    queryKey: ["checkout", "quote", product.slug, addOns, fromOrder ?? null, user?.id ?? null, coupon],
    queryFn: () =>
      api<{ quote: CheckoutQuote }>("/checkout/quote", {
        method: "POST",
        body: { productSlug: product.slug, addOnSlugs: addOns, fromOrder, couponCode: coupon || undefined },
      }).then((r) => r.quote),
    enabled: !userPending,
    placeholderData: (prev) => prev,
    retry: false,
  });

  // A book the quote no longer offers (owned, sold out of combo) is dropped from the selection.
  const offered = new Map((quote?.addOns ?? []).map((p) => [p.slug, p]));
  const toggle = (slug: string) =>
    setAddOns((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= MAX_ADD_ONS ? cur : [...cur, slug]));

  // Until the quote arrives, show the book's own price (USD abroad when it has one).
  const usdFallback = international && product.intlPriceCents != null;
  const fallbackLine: QuoteLine = {
    title: product.title,
    slug: product.slug,
    listPricePaise: product.effectivePricePaise,
    pricePaise: product.effectivePricePaise,
    combo: false,
    displayListMinor: usdFallback ? product.intlPriceCents! : product.effectivePricePaise,
    displayPriceMinor: usdFallback ? product.intlPriceCents! : product.effectivePricePaise,
  };
  // Charged in INR; shown in the quote's currency (USD for international visitors).
  const currency = quote?.currency ?? (usdFallback ? "USD" : "INR");
  const money = (minor: number) => formatMoney(minor, currency);
  const total = quote?.totalPaise ?? product.effectivePricePaise;
  const totalDisplay = quote?.totalDisplayMinor ?? fallbackLine.displayPriceMinor;
  const lines = quote?.lines ?? [fallbackLine];
  const listTotal = lines.reduce((s, l) => s + l.displayListMinor, 0);
  // INR shows the book's regular (pre-sale) price struck through; USD has no sale price.
  const regularTotal = currency === "INR" ? product.pricePaise - product.effectivePricePaise + listTotal : listTotal;
  const saleSavings = currency === "INR" ? product.pricePaise - product.effectivePricePaise : 0;
  const couponSavings = quote?.coupon?.discountDisplayMinor ?? 0;
  const comboSavings = (quote?.savingsDisplayMinor ?? 0) - couponSavings;
  const removeCoupon = () => {
    setCoupon("");
    forgetCoupon();
  };
  const left = useTimeLeft(quote?.offerExpiresAt ?? null);

  const plan = product.kind === "membership" && product.membershipDays ? product.membershipDays : null;
  const included = [
    ...(plan ? [{ icon: Sparkles, text: messages.membership.checkoutIncluded }] : []),
    { icon: Zap, text: t.included.instant },
    { icon: MonitorSmartphone, text: t.included.reader },
    { icon: Fingerprint, text: t.included.watermark },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      {/* Order summary: first on mobile, right column on desktop */}
      <aside className="lg:sticky lg:top-24 lg:order-2">
        <div className="bg-card overflow-hidden rounded-3xl border shadow-xl shadow-indigo-900/5">
          <div className="from-accent via-accent/40 to-card flex gap-4 bg-linear-to-b p-5 sm:p-6">
            <div className="relative w-20 shrink-0">
              <BookCover src={product.coverUrl} title={product.title} alt={tc.book.coverOf(product.title)} className="w-20" sizes="80px" />
              {lines.length > 1 && (
                <span className="bg-gradient-brand absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white shadow-md">
                  +{lines.length - 1}
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-1 self-center">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{t.summary}</p>
              <p className="line-clamp-3 leading-snug font-semibold">{product.title}</p>
              {product.author ? <p className="text-muted-foreground truncate text-sm">{product.author}</p> : null}
              <p className="text-muted-foreground text-xs">
                {plan
                  ? messages.membership.checkoutMeta(messages.membership.days(plan))
                  : lines.length > 1
                    ? t.combo.books(lines.length)
                    : t.itemMeta(tc.book.pages(product.pageCount))}
              </p>
            </div>
          </div>

          {quote?.offerExpiresAt && (
            <p className="bg-warning/10 text-warning flex items-center gap-2 border-t px-5 py-2.5 text-xs font-semibold sm:px-6">
              <Timer className="size-3.5 shrink-0" aria-hidden /> {t.combo.offerEnds(left ?? "")}
            </p>
          )}

          <dl className={cn("space-y-2.5 border-t p-5 text-sm transition-opacity sm:px-6", isPlaceholderData && "opacity-60")}>
            {lines.map((l) => (
              <div key={l.slug} className="flex justify-between gap-4">
                <dt className="text-muted-foreground min-w-0">
                  <span className="line-clamp-1">{l.title}</span>
                  {l.combo && (
                    <span className="bg-primary/10 text-primary mt-0.5 inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold uppercase">{t.combo.badge}</span>
                  )}
                </dt>
                {/* The coupon is shown as its own line, so each book shows its price before it. */}
                <dd className="shrink-0 text-right tabular-nums">
                  {l.displayPriceMinor + (l.couponDisplayMinor ?? 0) < l.displayListMinor && (
                    <span className="text-muted-foreground mr-1.5 text-xs line-through">{money(l.displayListMinor)}</span>
                  )}
                  {money(l.displayPriceMinor + (l.couponDisplayMinor ?? 0))}
                </dd>
              </div>
            ))}
            {saleSavings > 0 && lines.length === 1 && !lines[0]!.combo && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t.discount} <span className="text-success text-xs font-semibold">({tc.price.off(product.discountPercent)})</span>
                </dt>
                <dd className="text-success tabular-nums">−{formatINR(saleSavings)}</dd>
              </div>
            )}
            {quote?.coupon && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t.coupon.line(quote.coupon.code)}</dt>
                <dd className="text-success tabular-nums">−{money(couponSavings)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t border-dashed pt-3">
              <dt className="font-semibold">{t.total}</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {regularTotal > totalDisplay && <span className="text-muted-foreground mr-2 text-sm font-normal line-through">{money(regularTotal)}</span>}
                {money(totalDisplay)}
              </dd>
            </div>
            {comboSavings > 0 && <p className="text-success text-right text-xs font-semibold">{t.combo.youSave(money(comboSavings))}</p>}
            {currency === "USD" && quote?.fxRate ? (
              <p className="text-muted-foreground bg-muted/50 rounded-xl p-3 text-xs leading-relaxed">{t.intl.charged(formatINR(total), quote.fxRate.toFixed(2))}</p>
            ) : null}
          </dl>

          <CouponField
            key={quote?.coupon?.code ?? "none"}
            code={coupon}
            applied={quote?.coupon?.code ?? null}
            error={coupon && !isFetching ? (quote?.couponError ?? null) : null}
            busy={Boolean(coupon) && isFetching}
            onApply={setCoupon}
            onRemove={removeCoupon}
          />

          <div className="bg-muted/40 border-t p-5 sm:px-6">
            <p className="mb-3 text-xs font-semibold">{t.included.title}</p>
            <ul className="space-y-2.5">
              {included.map(({ icon: Icon, text }) => (
                <li key={text} className="text-muted-foreground flex gap-2.5 text-xs leading-relaxed">
                  <Icon className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <div className="space-y-6 lg:order-1">
        {/* Combo add-ons */}
        {quote === undefined ? (
          <Skeleton className="h-28 rounded-3xl" />
        ) : quote.addOns.length > 0 ? (
          <section className="bg-card rounded-3xl border p-5 sm:p-7" aria-labelledby="combo-add">
            <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="size-3.5" aria-hidden /> {t.combo.badge}
            </p>
            <h2 id="combo-add" className="mt-1 text-lg font-semibold tracking-tight">
              {t.combo.addTitle}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">{t.combo.addHint}</p>
            <ul className="mt-4 space-y-3">
              {quote.addOns.map((p) => (
                <AddOnRow key={p.id} product={p} selected={addOns.includes(p.slug)} disabled={!addOns.includes(p.slug) && addOns.length >= MAX_ADD_ONS} onToggle={() => toggle(p.slug)} />
              ))}
            </ul>
            {addOns.length >= MAX_ADD_ONS && <p className="text-muted-foreground mt-3 text-xs">{t.combo.max(MAX_ADD_ONS)}</p>}
          </section>
        ) : null}

        {/* Buyer details + payment */}
        <section className="bg-card rounded-3xl border p-5 sm:p-7" aria-labelledby="checkout-details">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="checkout-details" className="text-xl font-semibold tracking-tight">
              {t.details}
            </h2>
            <span className="bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <Check className="size-3.5" aria-hidden /> {currency === "USD" ? t.intl.methods : t.paymentMethods}
            </span>
          </div>
          <CheckoutPanel
            slug={product.slug}
            amountPaise={total}
            payLabel={currency === "USD" ? t.intl.payLabel(money(totalDisplay), formatINR(total)) : undefined}
            addOnSlugs={addOns.filter((s) => offered.has(s))}
            onAddOnOwned={(slug) => setAddOns((cur) => cur.filter((s) => s !== slug))}
            couponCode={quote?.coupon ? coupon : undefined}
            onCouponInvalid={removeCoupon}
          />
        </section>
      </div>
    </div>
  );
}

/** "Have a coupon?" link that opens a code field; shows the applied code with a way to remove it. */
function CouponField({
  code,
  applied,
  error,
  busy,
  onApply,
  onRemove,
}: {
  code: string;
  applied: string | null;
  error: string | null;
  busy: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const t = useMessages().checkout.coupon;
  const [open, setOpen] = useState(Boolean(code));
  const [draft, setDraft] = useState(code);

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
        <span className="text-success inline-flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <TicketPercent className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t.applied(applied)}</span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft("");
            onRemove();
          }}
        >
          {t.remove}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t px-5 py-3 sm:px-6">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          <TicketPercent className="size-4" aria-hidden /> {t.toggle}
        </button>
      ) : (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(draft.trim().toUpperCase());
          }}
        >
          <label htmlFor="coupon-code" className="text-xs font-semibold">
            {t.label}
          </label>
          <div className="flex gap-2">
            <Input
              id="coupon-code"
              value={draft}
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              placeholder={t.placeholder}
              autoComplete="off"
              maxLength={20}
              className="font-mono uppercase"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "coupon-error" : undefined}
            />
            <Button type="submit" variant="outline" disabled={!draft.trim() || busy}>
              {busy ? <Spinner /> : null} {t.apply}
            </Button>
          </div>
          {error && (
            <p id="coupon-error" role="alert" className="text-destructive text-xs">
              {t.error(error)}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function AddOnRow({ product: p, selected, disabled, onToggle }: { product: ProductSummary; selected: boolean; disabled: boolean; onToggle: () => void }) {
  const messages = useMessages();
  const t = messages.checkout.combo;
  const combo = displayCombo(p, useInternational());
  if (!combo) return null;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all disabled:opacity-50",
          selected ? "border-primary bg-primary/5 ring-primary/20 ring-2" : "hover:border-primary/40 hover:bg-muted/40",
        )}
      >
        <BookCover src={p.coverUrl} title={p.title} alt={messages.common.book.coverOf(p.title)} className="w-12 shrink-0" sizes="48px" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug font-medium">{p.title}</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
            <span className="font-semibold">{combo.price}</span>
            <span className="text-muted-foreground text-xs line-through">{combo.list}</span>
            <span className="text-success text-xs font-semibold">{t.save(combo.save)}</span>
          </span>
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {selected ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
          {selected ? t.added : t.add}
        </span>
      </button>
    </li>
  );
}
