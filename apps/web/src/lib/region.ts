import { formatINR, formatUSD, intlComboCents, type ProductSummary } from "@ebook/shared";

/** Set by the proxy from Vercel's geo header; read by the API to price international orders. */
export const COUNTRY_COOKIE = "rns_country";

/** Visitors outside India see a book's international (USD) price when it has one. */
export function isInternationalCountry(country: string | null | undefined): boolean {
  return Boolean(country) && country !== "IN";
}

type Priced = Pick<ProductSummary, "pricePaise" | "effectivePricePaise" | "comboPricePaise" | "intlPriceCents" | "intlComboPriceCents">;

/** The price a visitor sees for a book (USD abroad when set, else INR). */
export function displayPrice(p: Priced, international: boolean): { text: string; usd: boolean } {
  if (international && p.intlPriceCents != null) return { text: formatUSD(p.intlPriceCents), usd: true };
  return { text: formatINR(p.effectivePricePaise), usd: false };
}

/** A book's combo price for the visitor, with its own price for the strike-through. */
export function displayCombo(p: Priced, international: boolean): { price: string; list: string; save: string } | null {
  if (international && p.intlPriceCents != null) {
    const combo = intlComboCents({ ...p, intlComboPriceCents: p.intlComboPriceCents ?? null, comboPricePaise: p.comboPricePaise ?? null });
    if (combo == null) return null;
    return { price: formatUSD(combo), list: formatUSD(p.intlPriceCents), save: formatUSD(p.intlPriceCents - combo) };
  }
  if (p.comboPricePaise == null) return null;
  return { price: formatINR(p.comboPricePaise), list: formatINR(p.effectivePricePaise), save: formatINR(p.effectivePricePaise - p.comboPricePaise) };
}
