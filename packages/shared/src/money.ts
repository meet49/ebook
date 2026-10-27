/**
 * All monetary values are integer paise (1 INR = 100 paise).
 * Never use floating point rupees for arithmetic.
 */

export function assertPaise(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid paise amount: ${value}`);
  }
}

/** Parses a rupee string/number such as "999.50" into paise without float drift. */
export function rupeesToPaise(rupees: string | number): number {
  const str = typeof rupees === 'number' ? rupees.toFixed(2) : rupees.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) throw new RangeError(`Invalid rupee amount: ${rupees}`);
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const paise = whole * 100 + fraction;
  assertPaise(paise);
  return paise;
}

export function paiseToRupeesString(paise: number): string {
  assertPaise(paise);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}

/** Whole amounts without decimals ("₹199"); anything else with exactly two ("₹159.20"). */
function moneyFormatters(locale: string, currency: string) {
  const whole = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const exact = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (minor: number) => (minor % 100 === 0 ? whole : exact).format(minor / 100);
}

const inr = moneyFormatters('en-IN', 'INR');

export function formatINR(paise: number): string {
  return inr(paise);
}

/** Currencies prices are shown in. Payments are always charged in INR. */
export type DisplayCurrency = 'INR' | 'USD';

const usd = moneyFormatters('en-US', 'USD');

/** Formats US cents, e.g. 900 → "$9", 499 → "$4.99". */
export function formatUSD(cents: number): string {
  return usd(cents);
}

/** Formats an amount in the minor unit of its currency (paise or cents). */
export function formatMoney(minor: number, currency: DisplayCurrency): string {
  return currency === 'USD' ? formatUSD(minor) : formatINR(minor);
}

/** Parses a dollar string such as "9.99" into cents without float drift. */
export function dollarsToCents(dollars: string | number): number {
  return rupeesToPaise(dollars); // same 2-decimal rule
}

/**
 * A book's international combo price in cents: the one set by the admin, or its INR combo
 * discount applied to the international price. Null when it is not offered as a combo abroad.
 */
export function intlComboCents(p: {
  intlPriceCents: number | null;
  intlComboPriceCents: number | null;
  comboPricePaise: number | null;
  effectivePricePaise: number;
}): number | null {
  if (p.intlPriceCents == null) return null;
  if (p.intlComboPriceCents != null) return p.intlComboPriceCents;
  if (p.comboPricePaise == null || p.effectivePricePaise <= 0) return null;
  return Math.max(1, Math.round((p.intlPriceCents * p.comboPricePaise) / p.effectivePricePaise));
}
