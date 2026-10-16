import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, FileText, Globe, ShieldCheck, Zap } from "lucide-react";
import { BookCover } from "@/components/products/book-cover";
import { Price } from "@/components/products/price";
import { ProductGrid } from "@/components/products/product-card";
import { SamplePages } from "@/components/products/sample-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCatalog, getProduct } from "@/lib/server-api";

export async function generateMetadata({ params }: PageProps<"/ebooks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "eBook not found" };
  const description = product.subtitle || product.description.slice(0, 160);
  return {
    title: product.title,
    description,
    openGraph: { title: product.title, description, images: product.coverUrl ? [product.coverUrl] : undefined },
  };
}

export default async function ProductPage({ params }: PageProps<"/ebooks/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const more = (await getCatalog({ sort: "featured", pageSize: 5 })).items.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="text-muted-foreground mb-6 text-sm" aria-label="Breadcrumb">
        <Link href="/ebooks" className="hover:text-foreground">
          eBooks
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
        <div className="mx-auto w-56 sm:w-64 lg:w-full">
          <BookCover src={product.coverUrl} title={product.title} priority sizes="(min-width: 1024px) 320px, 256px" className="shadow-2xl shadow-indigo-900/15" />
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            {product.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.categories.map((c) => (
                  <Badge key={c} variant="secondary" asChild>
                    <Link href={`/ebooks?category=${encodeURIComponent(c)}`}>{c}</Link>
                  </Badge>
                ))}
              </div>
            )}
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{product.title}</h1>
            {product.subtitle && <p className="text-muted-foreground text-lg text-pretty">{product.subtitle}</p>}
            {product.author && <p className="text-sm">by <span className="font-medium">{product.author}</span></p>}
          </div>

          <Card className="shadow-none">
            <CardContent className="space-y-4">
              <Price
                size="lg"
                pricePaise={product.pricePaise}
                effectivePricePaise={product.effectivePricePaise}
                discountPercent={product.discountPercent}
              />
              <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-56">
                <Link href={`/checkout/${product.slug}`}>Buy now</Link>
              </Button>
              <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <Zap className="text-primary size-4" aria-hidden /> Instant access after payment
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="text-primary size-4" aria-hidden /> Secure checkout by Razorpay
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="text-primary size-4" aria-hidden /> {product.pageCount} pages
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="text-primary size-4" aria-hidden /> {product.language}
                </li>
              </ul>
            </CardContent>
          </Card>

          {product.benefits.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">What you&apos;ll get</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.benefits.map((b) => (
                  <li key={b} className="flex gap-2 text-sm">
                    <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {product.description && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">About this eBook</h2>
              <div className="text-muted-foreground leading-7 whitespace-pre-line">{product.description}</div>
            </section>
          )}

          {product.samples.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Read a sample</h2>
              <SamplePages title={product.title} samples={product.samples} />
            </section>
          )}

          {product.toc.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Table of contents</h2>
              <ol className="divide-y rounded-xl border">
                {product.toc.map((t, i) => (
                  <li key={`${t.page}-${i}`} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <span className={t.title.startsWith("— ") ? "text-muted-foreground pl-4" : "font-medium"}>{t.title}</span>
                    <span className="text-muted-foreground tabular-nums">p. {t.page}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-16 space-y-6 border-t pt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">More eBooks</h2>
            <Link href="/ebooks" className="text-primary text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid products={more} />
        </section>
      )}

    </div>
  );
}
