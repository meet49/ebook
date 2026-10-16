import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, SearchX } from "lucide-react";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/products/catalog-filters";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getCatalog, getCategories } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "All eBooks",
  description: "Browse every eBook in the store. Read samples, compare prices and start reading in seconds.",
};

const PAGE_SIZE = 12;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EbooksPage({ searchParams }: PageProps<"/ebooks">) {
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">All eBooks</h1>
        <p className="text-muted-foreground">Read samples, compare prices and start reading in seconds.</p>
      </div>

      <Suspense>
        <CatalogFilters categories={categories} />
      </Suspense>

      <p className="text-muted-foreground mt-6 mb-4 text-sm" aria-live="polite">
        {catalog.total} {catalog.total === 1 ? "eBook" : "eBooks"}
        {q ? ` matching “${q}”` : ""}
        {category ? ` in ${category}` : ""}
      </p>

      {catalog.items.length > 0 ? (
        <ProductGrid products={catalog.items} />
      ) : (
        <Empty className="min-h-[40vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{filtered ? <SearchX /> : <BookOpen />}</EmptyMedia>
            <EmptyTitle>{filtered ? "No eBooks match your search" : "Our first titles are on the way"}</EmptyTitle>
            <EmptyDescription>
              {filtered ? "Try a different search or browse all categories." : "Published eBooks will appear here automatically."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href="/ebooks">Clear filters</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>
            <Link href={pageHref(page - 1)} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="text-muted-foreground px-2 text-sm">
            Page {page} of {totalPages}
          </span>
          <Button asChild variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}>
            <Link href={pageHref(page + 1)} aria-disabled={page >= totalPages}>
              Next
            </Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
