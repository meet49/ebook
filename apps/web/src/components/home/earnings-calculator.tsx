"use client";

import { useId, useState } from "react";
import { formatINR } from "@ebook/shared";

const RATE_BPS = 2000; // the default commission rate; each eBook sets its own

/** Illustrative affiliate earnings: price × monthly sales × the default 20% rate. */
export function EarningsCalculator() {
  const [price, setPrice] = useState(499);
  const [sales, setSales] = useState(40);
  const priceId = useId();
  const salesId = useId();
  // Whole rupees keep the illustration easy to read.
  const perSale = Math.floor((price * RATE_BPS) / 10_000) * 100;
  const monthly = perSale * sales;

  return (
    <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur sm:p-6">
      <p className="text-sm font-medium text-white/80">Estimate your monthly earnings</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-live="polite">
        {formatINR(monthly)}
      </p>
      <p className="mt-1 text-sm text-white/70">
        {formatINR(perSale)} per sale × {sales} sales
      </p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor={priceId} className="text-white/80">
              eBook price
            </label>
            <span className="font-medium tabular-nums">{formatINR(price * 100)}</span>
          </div>
          <input
            id={priceId}
            type="range"
            min={99}
            max={1999}
            step={50}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor={salesId} className="text-white/80">
              Sales per month
            </label>
            <span className="font-medium tabular-nums">{sales}</span>
          </div>
          <input
            id={salesId}
            type="range"
            min={1}
            max={300}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
          />
        </div>
      </div>
      <p className="mt-5 text-xs text-white/60">
        Illustration at a 20% commission. Each eBook shows its own rate in your dashboard. Commission is paid on verified
        sales only.
      </p>
    </div>
  );
}
