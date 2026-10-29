import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { PixelEvent } from "@/components/analytics/meta-pixel";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { getMessages } from "@/i18n/server";
import { COUPON_COOKIE, couponFrom } from "@/lib/coupon";
import { getProduct } from "@/lib/server-api";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkout.metaTitle, robots: { index: false } };
}

const SLUG = /^[a-z0-9-]{1,80}$/;
const ORDER_NUMBER = /^EB-\d{8}-[A-Z2-9]{6}$/;

export default async function CheckoutPage({ params, searchParams }: PageProps<"/checkout/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  // ?add=a,b preselects combo add-ons; ?from=<order> shows a guest their post-purchase price.
  const addParam = typeof query.add === "string" ? query.add : "";
  const initialAddOns = addParam.split(",").filter((s) => SLUG.test(s) && s !== slug).slice(0, 3);
  const fromOrder = typeof query.from === "string" && ORDER_NUMBER.test(query.from) ? query.from : undefined;
  // ?coupon=CODE, or one remembered from a shared link.
  const initialCoupon = couponFrom(query.coupon) ?? couponFrom((await cookies()).get(COUPON_COOKIE)?.value);
  const product = await getProduct(slug);
  if (!product) notFound();

  const t = (await getMessages()).checkout;
  const steps = [t.steps.details, t.steps.pay, t.steps.read];

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

      <CheckoutClient product={product} initialAddOns={initialAddOns} fromOrder={fromOrder} initialCoupon={initialCoupon} />
      <PixelEvent
        key={product.slug}
        event="InitiateCheckout"
        params={{ content_ids: [product.slug], content_type: "product", content_name: product.title, num_items: 1, value: product.effectivePricePaise / 100, currency: "INR" }}
      />
    </div>
  );
}
