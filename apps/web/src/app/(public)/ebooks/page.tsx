import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/products/catalog-filters";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getMessages } from "@/i18n/server";
import { getCatalog, getCategories } from "@/lib/server-api";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).catalog;
  return { title: t.metaTitle, description: t.metaDescription };
}

const PAGE_SIZE = 12;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Page numbers to show: first, last and a window around the current page, with gaps as null. */
function pageWindow(page: number, total: number): (number | null)[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export default async function EbooksPage({ searchParams }: PageProps<"/ebooks">) {
  const t = (await getMessages()).catalog;
  const sp = await searchParams;
  const q = first(sp.q)?.slice(0, 100);
  const category = first(sp.category)?.slice(0, 40);
  const sortParam = first(sp.sort);
  const sort = ["featured", "newest", "price_asc", "price_desc"].includes(sortParam ?? "") ? sortParam : "featured";
  const page = Math.max(1, Math.min(1000, Number(first(sp.page)) || 1));

  const [catalog, categories] = await Promise.all([
    getCatalog({ q, category, sort, page, pageSize: PAGE_SIZE }),
    getCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(catalog.total / PAGE_SIZE));
  const filtered = Boolean(q || category);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    if (sort && sort !== "featured") next.set("sort", sort);
    if (n > 1) next.set("page", String(n));
    return `/ebooks${next.size ? `?${next}` : ""}`;
  };

  const pagePill =
    "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      {/* Hero strip with search and filters */}
      <section className="from-accent/80 via-background to-background relative isolate overflow-hidden rounded-3xl border bg-linear-to-b px-4 py-8 sm:px-10 sm:py-12">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-70" />
        <div aria-hidden className="bg-primary/15 absolute -top-24 -right-24 -z-10 size-72 rounded-full blur-3xl" />
        <div aria-hidden className="bg-brand-violet/10 absolute -bottom-32 -left-20 -z-10 size-72 rounded-full blur-3xl" />

        <div className="mx-auto max-w-3xl space-y-3 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t.titleBefore} <span className="font-display text-gradient-brand pr-1 font-normal italic">{t.titleAccent}</span> {t.titleAfter}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-pretty sm:text-lg">{t.subtitle}</p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <Suspense>
            <CatalogFilters categories={categories} />
          </Suspense>
        </div>
      </section>

      <div className="mt-8 mb-5 flex flex-wrap items-baseline gap-x-2 gap-y-1" aria-live="polite">
        <p className="text-lg font-semibold tracking-tight">{t.count(catalog.total)}</p>
        {(q || category) && (
          <p className="text-muted-foreground text-sm">
            {[q ? t.matching(q) : null, category ? t.inCategory(category) : null].filter(Boolean).join(" ")}
          </p>
        )}
      </div>

      {catalog.items.length > 0 ? (
        <ProductGrid products={catalog.items} />
      ) : (
        <Empty className="bg-card min-h-[40vh] rounded-3xl border py-14">
          <EmptyHeader>
            <EmptyMedia className="bg-accent text-primary size-14 rounded-2xl [&_svg]:size-6!" variant="icon">
              {filtered ? <SearchX /> : <BookOpen />}
            </EmptyMedia>
            <EmptyTitle className="text-lg">{filtered ? t.noResults.title : t.emptyStore.title}</EmptyTitle>
            <EmptyDescription>{filtered ? t.noResults.body : t.emptyStore.body}</EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/ebooks">{t.clearFilters}</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {totalPages > 1 && (
        <nav className="mt-12 flex flex-col items-center gap-3" aria-label={t.pagination.label}>
          <ul className="flex flex-wrap items-center justify-center gap-1.5">
            <li>
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={cn(pagePill, "bg-background hover:bg-accent sm:pr-4")} rel="prev">
                  <ChevronLeft className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">{t.pagination.previous}</span>
                </Link>
              ) : (
                <span aria-disabled className={cn(pagePill, "text-muted-foreground pointer-events-none opacity-50 sm:pr-4")}>
                  <ChevronLeft className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">{t.pagination.previous}</span>
                </span>
              )}
            </li>
            {pageWindow(page, totalPages).map((n, i) =>
              n === null ? (
                <li key={`gap-${i}`} aria-hidden className="text-muted-foreground px-1">
                  …
                </li>
              ) : (
                <li key={n}>
                  <Link
                    href={pageHref(n)}
                    aria-label={t.pagination.page(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={cn(
                      pagePill,
                      n === page ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-accent",
                    )}
                  >
                    {n}
                  </Link>
                </li>
              ),
            )}
            <li>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className={cn(pagePill, "bg-background hover:bg-accent sm:pl-4")} rel="next">
                  <span className="sr-only sm:not-sr-only">{t.pagination.next}</span> <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <span aria-disabled className={cn(pagePill, "text-muted-foreground pointer-events-none opacity-50 sm:pl-4")}>
                  <span className="sr-only sm:not-sr-only">{t.pagination.next}</span> <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">{t.pagination.pageOf(page, totalPages)}</p>
        </nav>
      )}
    </div>
  );
}
