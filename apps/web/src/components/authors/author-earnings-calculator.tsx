"use client";

import { useId, useState } from "react";
import { DEFAULT_AUTHOR_SHARE_PERCENT, formatINR } from "@ebook/shared";
import { Switch } from "@/components/ui/switch";
import { useMessages } from "@/i18n/client";

const AFFILIATE_PERCENT = 20; // the default commission rate; each eBook can set its own

/** Illustrative author earnings: (price − affiliate commission, if any) × the default share. */
export function AuthorEarningsCalculator() {
  const t = useMessages().author.landing.calc;
  const [price, setPrice] = useState(199);
  const [sales, setSales] = useState(50);
  const [viaAffiliate, setViaAffiliate] = useState(true);
  const priceId = useId();
  const salesId = useId();
  const affiliateId = useId();

  const pricePaise = price * 100;
  const commission = viaAffiliate ? Math.floor((pricePaise * AFFILIATE_PERCENT) / 100) : 0;
  const perSale = Math.floor(((pricePaise - commission) * DEFAULT_AUTHOR_SHARE_PERCENT) / 100);

  return (
    <div className="rounded-3xl bg-white/10 p-5 text-white ring-1 ring-white/15 backdrop-blur sm:p-6">
      <p className="text-sm font-medium text-white/80">{t.youEarn}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-live="polite">
        {formatINR(perSale)}
      </p>
      <p className="mt-1 text-sm text-white/75" aria-live="polite">
        {t.monthly(sales, formatINR(perSale * sales))}
      </p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor={priceId} className="text-white/80">
              {t.price}
            </label>
            <span className="font-medium tabular-nums">{formatINR(pricePaise)}</span>
          </div>
          <input
            id={priceId}
            type="range"
            min={49}
            max={999}
            step={10}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label htmlFor={salesId} className="text-white/80">
              {t.sales}
            </label>
            <span className="font-medium tabular-nums">{sales}</span>
          </div>
          <input
            id={salesId}
            type="range"
            min={1}
            max={500}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-3">
          <label htmlFor={affiliateId} className="text-sm text-white/85">
            {t.viaAffiliate}
          </label>
          <Switch id={affiliateId} checked={viaAffiliate} onCheckedChange={setViaAffiliate} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white/10 p-2.5">
            <dt className="text-white/70">{t.price}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(pricePaise)}</dd>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <dt className="text-white/70">−{AFFILIATE_PERCENT}%</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{commission ? `−${formatINR(commission)}` : "—"}</dd>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <dt className="text-white/70">
              {t.share} {DEFAULT_AUTHOR_SHARE_PERCENT}%
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(perSale)}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-5 text-xs text-white/60">{t.note}</p>
    </div>
  );
}
