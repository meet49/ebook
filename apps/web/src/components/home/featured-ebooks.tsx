import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductGrid } from "@/components/products/product-card";
import { getCatalog } from "@/lib/server-api";

/** Featured titles, falling back to the newest ones until something is marked featured. */
export async function FeaturedEbooks() {
  let catalog = await getCatalog({ featured: true, sort: "newest", pageSize: 4 }).catch(() => null);
  if (catalog && catalog.items.length === 0) catalog = await getCatalog({ sort: "newest", pageSize: 4 }).catch(() => null);
  if (!catalog || catalog.items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Featured eBooks</h2>
          <p className="text-muted-foreground mt-1">Hand-picked titles to start with.</p>
        </div>
        <Link href="/ebooks" className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">
          View all <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ProductGrid products={catalog.items} />
    </section>
  );
}
