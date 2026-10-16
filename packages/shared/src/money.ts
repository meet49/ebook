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

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number): string {
  return inrFormatter.format(paise / 100);
}
