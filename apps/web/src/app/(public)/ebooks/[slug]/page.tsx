import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Check,
  ChevronRight,
  FileText,
  Fingerprint,
  Globe,
  ListOrdered,
  Lock,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  Zap,
} from "lucide-react";
import { formatINR, formatUSD, intlComboCents } from "@ebook/shared";
import { PixelEvent } from "@/components/analytics/meta-pixel";
import { BookCover } from "@/components/products/book-cover";
import { Price } from "@/components/products/price";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getMessages } from "@/i18n/server";
import { isInternationalVisitor } from "@/lib/region-server";
import { absoluteUrl, jsonLd, organizationLd } from "@/lib/seo";
import { getCatalog, getMembership, getProduct } from "@/lib/server-api";

export async function generateMetadata({ params }: PageProps<"/ebooks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: (await getMessages()).product.notFound };
  const description = (product.subtitle || product.description).replace(/\s+/g, " ").trim().slice(0, 160);
  const path = `/ebooks/${product.slug}`;
  return {
    title: product.author ? `${product.title} by ${product.author}` : product.title,
    description,
    alternates: { canonical: path },
    // The share image comes from ./opengraph-image.tsx (cover, title and price).
    openGraph: { type: "book", url: path, title: product.title, description, authors: product.author ? [product.author] : undefined },
    twitter: { card: "summary_large_image", title: product.title, description },
  };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl">
      <span className="bg-accent text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4.5" aria-hidden />
      </span>
      {children}
    </h2>
  );
}

export default async function ProductPage({ params }: PageProps<"/ebooks/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  if (product.kind === "membership") permanentRedirect("/membership");

  const messages = await getMessages();
  // "Included in ReadnShare Pass" only while a plan is on sale.
  const passOnSale = product.includedInMembership && Boolean((await getMembership())?.plans.length);
  const t = messages.product;
  const tc = messages.common;
  // Visitors outside India see the international (USD) price where the book has one.
  const intl = (await isInternationalVisitor()) && product.intlPriceCents != null;

  // Structured data: lets Google show the book with its price and availability in results.
  const productUrl = absoluteUrl(`/ebooks/${product.slug}`);
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd,
      {
        "@type": ["Product", "Book"],
        "@id": `${productUrl}#book`,
        name: product.title,
        description: product.description || product.subtitle || undefined,
        url: productUrl,
        image: product.coverUrl ? absoluteUrl(product.coverUrl) : undefined,
        sku: product.slug,
        category: product.categories[0],
        inLanguage: product.language,
        numberOfPages: product.pageCount || undefined,
        bookFormat: "https://schema.org/EBook",
        author: product.author ? { "@type": "Person", name: product.author } : undefined,
        brand: { "@id": organizationLd["@id"] },
        offers: {
          "@type": "Offer",
          url: productUrl,
          price: (product.effectivePricePaise / 100).toFixed(2),
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": organizationLd["@id"] },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "eBooks", item: absoluteUrl("/ebooks") },
          { "@type": "ListItem", position: 3, name: product.title, item: productUrl },
        ],
      },
    ],
  };

  const more = (await getCatalog({ sort: "featured", pageSize: 5 })).items.filter((p) => p.id !== product.id).slice(0, 4);
  const checkoutHref = `/checkout/${product.slug}`;

  const trust: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Zap, title: t.trust.instantTitle, body: t.trust.instantBody },
    { icon: MonitorSmartphone, title: t.trust.readerTitle, body: t.trust.readerBody },
    { icon: Fingerprint, title: t.trust.watermarkTitle, body: t.trust.watermarkBody },
    { icon: ShieldCheck, title: t.trust.razorpayTitle, body: t.trust.razorpayBody },
  ];

  return (
    <div className="relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <PixelEvent
        key={product.slug}
        event="ViewContent"
        params={{ content_ids: [product.slug], content_type: "product", content_name: product.title, value: product.effectivePricePaise / 100, currency: "INR" }}
      />
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 lg:pb-20">
        <nav className="text-muted-foreground mb-6 text-sm" aria-label={t.breadcrumb}>
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="shrink-0">
              <Link href="/ebooks" className="hover:text-foreground transition-colors">
                {tc.nav.ebooks}
              </Link>
            </li>
            <li aria-hidden className="shrink-0">
              <ChevronRight className="size-3.5" />
            </li>
            <li className="text-foreground min-w-0 truncate font-medium" aria-current="page">
              {product.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          {/* Cover + title */}
          <header className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr] md:items-center lg:col-start-1">
            <div className="from-accent via-accent/50 to-muted/40 relative isolate flex justify-center overflow-hidden rounded-3xl border bg-linear-to-b px-10 pt-10 pb-12">
              <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-60" />
              <div aria-hidden className="bg-primary/30 absolute bottom-6 left-1/2 -z-10 h-10 w-3/4 -translate-x-1/2 rounded-full blur-2xl" />
              <div aria-hidden className="bg-brand-violet/20 absolute -top-16 -right-16 -z-10 size-48 rounded-full blur-3xl" />
              <BookCover
                src={product.coverUrl}
                title={product.title}
                alt={tc.book.coverOf(product.title)}
                priority
                sizes="(min-width: 768px) 220px, 208px"
                className="w-44 shadow-2xl shadow-indigo-900/25 sm:w-52 md:w-full md:max-w-56 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500"
              />
            </div>

            <div className="space-y-4">
              {product.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((c) => (
                    <Link
                      key={c}
                      href={`/ebooks?category=${encodeURIComponent(c)}`}
                      className="bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              )}
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{product.title}</h1>
              {product.subtitle && <p className="text-muted-foreground text-lg text-pretty">{product.subtitle}</p>}
              {product.author && (
                <p className="text-sm">
                  <span className="text-muted-foreground">{tc.book.by}</span> <span className="font-semibold">{product.author}</span>
                </p>
              )}
              <ul className="flex flex-wrap gap-2 pt-1 text-sm">
                {product.pageCount > 0 && (
                  <li className="bg-card flex items-center gap-1.5 rounded-full border px-3 py-1.5">
                    <FileText className="text-primary size-4" aria-hidden />
                    <span className="sr-only">{t.pages}: </span>
                    {tc.book.pages(product.pageCount)}
                  </li>
                )}
                {product.language && (
                  <li className="bg-card flex items-center gap-1.5 rounded-full border px-3 py-1.5">
                    <Globe className="text-primary size-4" aria-hidden />
                    <span className="sr-only">{t.language}: </span>
                    {product.language}
                  </li>
                )}
                <li className="bg-card flex items-center gap-1.5 rounded-full border px-3 py-1.5">
                  <MonitorSmartphone className="text-primary size-4" aria-hidden />
                  <span className="sr-only">{t.format}: </span>
                  {t.formatValue}
                </li>
              </ul>
            </div>
          </header>

          {/* Purchase card: inline on mobile, sticky in the right column on desktop */}
          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="bg-card rounded-3xl border p-5 shadow-xl shadow-indigo-900/5 sm:p-6 lg:sticky lg:top-24">
              <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">{t.ebook}</p>
              <Price
                size="lg"
                pricePaise={product.pricePaise}
                effectivePricePaise={product.effectivePricePaise}
                discountPercent={product.discountPercent}
                intlPriceCents={product.intlPriceCents}
              />
              <p className="text-muted-foreground mt-1.5 text-xs">{intl ? t.intlNote : t.oneTimePrice}</p>
              <Button asChild size="lg" className="mt-5 h-12 w-full rounded-full text-base shadow-lg shadow-indigo-900/15">
                <Link href={checkoutHref}>
                  <Lock aria-hidden /> {t.buyNow}
                </Link>
              </Button>
              <p className="text-muted-foreground mt-3 flex items-start justify-center gap-1.5 text-center text-xs">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden /> {t.securePay}
              </p>
              {passOnSale && (
                <Link
                  href="/membership"
                  className="bg-primary/5 border-primary/20 hover:bg-primary/10 mt-4 flex items-center gap-3 rounded-2xl border p-3 transition-colors"
                >
                  <Ticket className="text-primary size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{messages.membership.bookBadge}</span>
                    <span className="text-primary text-xs font-medium">{messages.membership.bookBadgeCta} →</span>
                  </span>
                </Link>
              )}
              <Separator className="my-5" />
              <ul className="space-y-4">
                {trust.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Details */}
          <div className="min-w-0 space-y-12 lg:col-start-1">
            {product.addOns.length > 0 && (
              <section className="from-accent to-card relative overflow-hidden rounded-3xl border bg-linear-to-br p-5 sm:p-6" aria-labelledby="buy-together">
                <div aria-hidden className="bg-gradient-brand absolute inset-x-0 top-0 h-1" />
                <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Sparkles className="size-3.5" aria-hidden /> {t.buyTogether.eyebrow}
                </p>
                <h2 id="buy-together" className="mt-1 text-xl font-semibold tracking-tight">
                  {t.buyTogether.title}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm">{t.buyTogether.body}</p>
                <ul className="mt-5 space-y-3">
                  {product.addOns.map((addOn) => {
                    const combo = addOn.comboPricePaise ?? addOn.effectivePricePaise;
                    const usdCombo = intl && addOn.intlPriceCents != null ? intlComboCents(addOn) : null;
                    const prices =
                      usdCombo != null
                        ? {
                            price: formatUSD(usdCombo),
                            list: formatUSD(addOn.intlPriceCents!),
                            save: formatUSD(addOn.intlPriceCents! - usdCombo),
                            both: formatUSD(product.intlPriceCents! + usdCombo),
                          }
                        : {
                            price: formatINR(combo),
                            list: formatINR(addOn.effectivePricePaise),
                            save: formatINR(addOn.effectivePricePaise - combo),
                            both: formatINR(product.effectivePricePaise + combo),
                          };
                    return (
                      <li key={addOn.id} className="bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2">
                          <BookCover src={product.coverUrl} title={product.title} alt={tc.book.coverOf(product.title)} className="w-12 shrink-0" sizes="48px" />
                          <Plus className="text-muted-foreground size-4 shrink-0" aria-hidden />
                          <Link href={`/ebooks/${addOn.slug}`} className="shrink-0">
                            <BookCover src={addOn.coverUrl} title={addOn.title} alt={tc.book.coverOf(addOn.title)} className="w-12" sizes="48px" />
                          </Link>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/ebooks/${addOn.slug}`} className="line-clamp-2 text-sm leading-snug font-medium hover:underline">
                            {addOn.title}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums">
                            <span className="text-muted-foreground text-xs">{t.buyTogether.comboPrice}</span>
                            <span className="font-semibold">{prices.price}</span>
                            <span className="text-muted-foreground text-xs line-through">{prices.list}</span>
                            <span className="text-success text-xs font-semibold">{t.buyTogether.save(prices.save)}</span>
                          </p>
                        </div>
                        <Button asChild className="shrink-0 rounded-full">
                          <Link href={`/checkout/${product.slug}?add=${addOn.slug}`}>{t.buyTogether.both(prices.both)}</Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {product.benefits.length > 0 && (
              <section className="space-y-5">
                <SectionTitle icon={Sparkles}>{t.benefits}</SectionTitle>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {product.benefits.map((b) => (
                    <li key={b} className="bg-card flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed">
                      <span className="bg-success/15 text-success flex size-6 shrink-0 items-center justify-center rounded-full">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {product.description && (
              <section className="space-y-5">
                <SectionTitle icon={BookOpenText}>{t.about}</SectionTitle>
                <div className="text-muted-foreground max-w-prose text-[0.95rem] leading-7 whitespace-pre-line">{product.description}</div>
              </section>
            )}

            {product.toc.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-end justify-between gap-4">
                  <SectionTitle icon={ListOrdered}>{t.toc.title}</SectionTitle>
                  <span className="text-muted-foreground shrink-0 pb-1 text-xs">{t.toc.count(product.toc.length)}</span>
                </div>
                <ol className="bg-card divide-y overflow-hidden rounded-2xl border">
                  {product.toc.map((entry, i) => {
                    const sub = entry.title.startsWith("— ");
                    return (
                      <li key={`${entry.page}-${i}`} className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors">
                        <span className={sub ? "text-muted-foreground pl-5" : "font-medium"}>{entry.title}</span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{t.toc.page(entry.page)}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-20 space-y-6 border-t pt-12">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.more.eyebrow}</p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.more.title}</h2>
              </div>
              <Link href="/ebooks" className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
                {tc.actions.viewAll} <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ProductGrid products={more} />
          </section>
        )}
      </div>

      {/* Mobile buy bar: sticks to the bottom while the page scrolls, settles above the footer. */}
      <div className="bg-background/90 sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-xs">{product.title}</p>
            <Price
              pricePaise={product.pricePaise}
              effectivePricePaise={product.effectivePricePaise}
              discountPercent={product.discountPercent}
              intlPriceCents={product.intlPriceCents}
            />
          </div>
          <Button asChild size="lg" className="shrink-0 rounded-full px-6">
            <Link href={checkoutHref}>{t.buyNow}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
