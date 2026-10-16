import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import type { ProductSummary } from "@ebook/shared";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import type { HomeMessages } from "@/i18n/messages/home";

/**
 * The landing page's book shelf: a swipeable row on phones, a grid on larger screens.
 * Shows a friendly "coming soon" card while nothing is published yet.
 */
export function FeaturedEbooks({ books, categories, t }: { books: ProductSummary[]; categories: string[]; t: HomeMessages["shelf"] }) {
  return (
    <section className="relative isolate py-16 sm:py-20" aria-labelledby="featured-title">
      <div aria-hidden className="from-muted/0 via-muted/60 to-muted/0 absolute inset-0 -z-10 bg-linear-to-b" />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.eyebrow}</p>
            <h2 id="featured-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.title}
            </h2>
            <p className="text-muted-foreground mt-1.5">{t.subtitle}</p>
          </div>
          {books.length > 0 && (
            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/ebooks">
                {t.viewAll} <ArrowRight />
              </Link>
            </Button>
          )}
        </div>

        {books.length > 0 ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {books.map((book, i) => (
              <ProductCard key={book.id} product={book} priority={i < 2} className="w-[68%] shrink-0 snap-start sm:w-auto" />
            ))}
          </div>
        ) : (
          <div className="bg-card relative overflow-hidden rounded-3xl border p-8 text-center sm:p-12">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-60" />
            <div className="relative mx-auto flex max-w-lg flex-col items-center gap-4">
              <span className="bg-gradient-brand flex size-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-900/20">
                <BookOpen className="size-6" aria-hidden />
              </span>
              <h3 className="text-xl font-semibold">{t.emptyTitle}</h3>
              <p className="text-muted-foreground">{t.emptyBody}</p>
              <Button asChild className="rounded-full">
                <Link href="/affiliates">
                  <Sparkles /> {t.emptyCta}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-1 text-sm font-medium">{t.categories}</span>
            {categories.map((c) => (
              <Link
                key={c}
                href={`/ebooks?category=${encodeURIComponent(c)}`}
                className="bg-background hover:border-primary/40 hover:text-primary rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
              >
                {c}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
