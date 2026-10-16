import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Fingerprint, Lock, MonitorSmartphone, Zap } from "lucide-react";
import { formatINR } from "@ebook/shared";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { BookCover } from "@/components/products/book-cover";
import { getMessages } from "@/i18n/server";
import { getProduct } from "@/lib/server-api";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkout.metaTitle, robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/checkout/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const messages = await getMessages();
  const t = messages.checkout;
  const tc = messages.common;
  const onSale = product.discountPercent > 0 && product.pricePaise > product.effectivePricePaise;

  const steps = [t.steps.details, t.steps.pay, t.steps.read];
  const included = [
    { icon: Zap, text: t.included.instant },
    { icon: MonitorSmartphone, text: t.included.reader },
    { icon: Fingerprint, text: t.included.watermark },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link
        href={`/ebooks/${product.slug}`}
        className="text-muted-foreground hover:text-foreground hover:bg-accent -ml-3 mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t.backToBook}
      </Link>

      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Lock className="size-3.5" aria-hidden /> {t.eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="text-muted-foreground max-w-md text-pretty">{t.subtitle}</p>
        </div>

        <ol aria-label={t.steps.label} className="flex items-center gap-2 text-xs font-medium sm:text-sm">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2" aria-current={i === 0 ? "step" : undefined}>
              {i > 0 && <span aria-hidden className="bg-border h-px w-4 sm:w-6" />}
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  i === 0 ? "bg-gradient-brand text-white shadow-sm" : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* Order summary: first on mobile, right column on desktop */}
        <aside className="lg:sticky lg:top-24 lg:order-2">
          <div className="bg-card overflow-hidden rounded-3xl border shadow-xl shadow-indigo-900/5">
            <div className="from-accent via-accent/40 to-card flex gap-4 bg-linear-to-b p-5 sm:p-6">
              <BookCover src={product.coverUrl} title={product.title} alt={tc.book.coverOf(product.title)} className="w-20 shrink-0" sizes="80px" />
              <div className="min-w-0 space-y-1 self-center">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{t.summary}</p>
                <p className="line-clamp-3 leading-snug font-semibold">{product.title}</p>
                {product.author ? <p className="text-muted-foreground truncate text-sm">{product.author}</p> : null}
                <p className="text-muted-foreground text-xs">{t.itemMeta(tc.book.pages(product.pageCount))}</p>
              </div>
            </div>

            <dl className="space-y-2.5 border-t p-5 text-sm sm:px-6">
              {onSale && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t.subtotal}</dt>
                    <dd className="tabular-nums">{formatINR(product.pricePaise)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {t.discount} <span className="text-success text-xs font-semibold">({tc.price.off(product.discountPercent)})</span>
                    </dt>
                    <dd className="text-success tabular-nums">−{formatINR(product.pricePaise - product.effectivePricePaise)}</dd>
                  </div>
                </>
              )}
              <div className={cn("flex items-baseline justify-between gap-4", onSale && "border-t border-dashed pt-3")}>
                <dt className="font-semibold">{t.total}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{formatINR(product.effectivePricePaise)}</dd>
              </div>
            </dl>

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

        {/* Buyer details + payment */}
        <section className="bg-card rounded-3xl border p-5 sm:p-7 lg:order-1" aria-labelledby="checkout-details">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="checkout-details" className="text-xl font-semibold tracking-tight">
              {t.details}
            </h2>
            <span className="bg-success/10 text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <Check className="size-3.5" aria-hidden /> {t.paymentMethods}
            </span>
          </div>
          <CheckoutPanel slug={product.slug} amountPaise={product.effectivePricePaise} />
        </section>
      </div>
    </div>
  );
}
