import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { BookCover } from "@/components/products/book-cover";
import { Price } from "@/components/products/price";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProduct } from "@/lib/server-api";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/checkout/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/ebooks/${product.slug}`} className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Back to book
      </Link>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Checkout</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card className="h-fit shadow-none">
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-4">
              <BookCover src={product.coverUrl} title={product.title} className="w-20 shrink-0" sizes="80px" />
              <div className="min-w-0 space-y-1">
                <p className="leading-snug font-medium">{product.title}</p>
                {product.author ? <p className="text-muted-foreground text-sm">{product.author}</p> : null}
                <p className="text-muted-foreground text-sm">eBook · {product.pageCount} pages · read online</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="font-medium">Total</span>
              <Price pricePaise={product.pricePaise} effectivePricePaise={product.effectivePricePaise} discountPercent={product.discountPercent} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckoutPanel slug={product.slug} amountPaise={product.effectivePricePaise} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
