import Link from "next/link";
import type { ProductSummary } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "./book-cover";
import { Price } from "./price";

export function ProductCard({ product, priority }: { product: ProductSummary; priority?: boolean }) {
  return (
    <Link
      href={`/ebooks/${product.slug}`}
      className="group focus-visible:ring-ring/50 flex flex-col gap-3 rounded-2xl p-2 outline-none focus-visible:ring-3"
    >
      <div className="relative">
        <BookCover
          src={product.coverUrl}
          title={product.title}
          priority={priority}
          className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
        />
        {product.discountPercent > 0 && (
          <Badge className="bg-success absolute top-2 right-2 text-white">-{product.discountPercent}%</Badge>
        )}
      </div>
      <div className="space-y-1 px-1">
        <h3 className="group-hover:text-primary line-clamp-2 leading-snug font-semibold transition-colors">{product.title}</h3>
        {product.author ? <p className="text-muted-foreground line-clamp-1 text-sm">{product.author}</p> : null}
        <Price
          pricePaise={product.pricePaise}
          effectivePricePaise={product.effectivePricePaise}
          discountPercent={product.discountPercent}
        />
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
