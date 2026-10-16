"use client";

import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { ProductSummary } from "@ebook/shared";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { BookCover } from "./book-cover";
import { Price } from "./price";

/** A book on a soft tinted "stage": the cover lifts on hover, details sit below. */
export function ProductCard({ product, priority, className }: { product: ProductSummary; priority?: boolean; className?: string }) {
  const t = useMessages().common.book;
  return (
    <Link
      href={`/ebooks/${product.slug}`}
      className={cn(
        "group bg-card focus-visible:ring-ring/50 relative flex flex-col overflow-hidden rounded-3xl border outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/10 focus-visible:ring-3",
        className,
      )}
    >
      <div className="from-accent via-accent/40 to-muted/30 relative flex justify-center bg-linear-to-b px-6 pt-6 pb-5 sm:px-8">
        <div aria-hidden className="bg-primary/25 absolute bottom-3 left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-full blur-xl transition-opacity group-hover:opacity-80" />
        <BookCover
          src={product.coverUrl}
          title={product.title}
          alt={t.coverOf(product.title)}
          priority={priority}
          sizes="(min-width: 1024px) 200px, 40vw"
          className="w-full max-w-44 transition-transform duration-500 group-hover:scale-[1.03] group-hover:-rotate-1"
        />
        {product.discountPercent > 0 && (
          <span className="bg-success absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            -{product.discountPercent}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.categories[0] ? (
          <span className="text-primary text-[11px] font-semibold tracking-wider uppercase">{product.categories[0]}</span>
        ) : null}
        <h3 className="line-clamp-2 leading-snug font-semibold">{product.title}</h3>
        {product.author ? <p className="text-muted-foreground line-clamp-1 text-sm">{product.author}</p> : null}
        {product.pageCount > 0 ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <FileText className="size-3.5" aria-hidden /> {t.pages(product.pageCount)}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price pricePaise={product.pricePaise} effectivePricePaise={product.effectivePricePaise} discountPercent={product.discountPercent} />
          <span className="bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors">
            <ArrowUpRight className="size-4" aria-hidden />
            <span className="sr-only">{t.view}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
