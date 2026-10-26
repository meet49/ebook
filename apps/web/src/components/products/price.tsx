"use client";

import { formatINR, formatUSD } from "@ebook/shared";
import { useMessages } from "@/i18n/client";
import { useInternational } from "@/lib/region-client";
import { cn } from "@/lib/utils";

export function Price({
  pricePaise,
  effectivePricePaise,
  discountPercent,
  intlPriceCents = null,
  size = "md",
  className,
}: {
  pricePaise: number;
  effectivePricePaise: number;
  discountPercent: number;
  /** Shown instead of the INR price to visitors outside India, when set. */
  intlPriceCents?: number | null;
  size?: "md" | "lg";
  className?: string;
}) {
  const t = useMessages().common.price;
  const international = useInternational();
  if (international && intlPriceCents != null) {
    return (
      <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
        <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-base")}>{formatUSD(intlPriceCents)}</span>
      </div>
    );
  }
  const onSale = discountPercent > 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-base")}>
        {formatINR(effectivePricePaise)}
      </span>
      {onSale && (
        <>
          <span className={cn("text-muted-foreground tabular-nums line-through", size === "lg" ? "text-lg" : "text-sm")}>
            <span className="sr-only">{t.regular} </span>
            {formatINR(pricePaise)}
          </span>
          <span className="text-success text-xs font-semibold">{t.off(discountPercent)}</span>
        </>
      )}
    </div>
  );
}
