import { SETTING_KEYS, Setting } from '../models/Setting';
import { logger } from './logger';

/**
 * INR per 1 USD, used to charge international prices in INR. Fetched from a free public rate
 * feed at most twice a day and remembered in the database, so a feed outage falls back to the
 * last known rate. With no rate at all, callers show and charge the INR price instead.
 */
const REFRESH_MS = 12 * 60 * 60_000;
const SANE = (rate: number) => Number.isFinite(rate) && rate > 30 && rate < 300;

type RateProvider = () => Promise<number>;

async function openExchangeRates(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Rate feed returned ${res.status}`);
  const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
  const rate = body.rates?.INR;
  if (body.result !== 'success' || typeof rate !== 'number') throw new Error('Rate feed had no INR rate');
  return rate;
}

let provider: RateProvider = openExchangeRates;
let cache: { rate: number; at: number } | null = null;

/** Tests swap in a fixed rate (or a failing provider); null restores the real feed. */
export function setFxProvider(p: RateProvider | null): void {
  provider = p ?? openExchangeRates;
  cache = null;
}

/** INR per USD, or null when no rate is available (then prices stay in INR). */
export async function usdToInrRate(): Promise<number | null> {
  if (cache && Date.now() - cache.at < REFRESH_MS) return cache.rate;
  try {
    const rate = await provider();
    if (!SANE(rate)) throw new Error(`Implausible USD/INR rate ${rate}`);
    cache = { rate, at: Date.now() };
    await Setting.updateOne({ key: SETTING_KEYS.fxUsdInr }, { $set: { value: { rate, fetchedAt: new Date() } } }, { upsert: true });
    return rate;
  } catch (err) {
    const stored = (await Setting.findOne({ key: SETTING_KEYS.fxUsdInr }))?.value as { rate?: number } | undefined;
    if (stored?.rate && SANE(stored.rate)) {
      logger.warn({ err }, 'Exchange-rate feed failed; using the last stored USD/INR rate');
      // Retry the feed in an hour rather than on every request.
      cache = { rate: stored.rate, at: Date.now() - REFRESH_MS + 60 * 60_000 };
      return stored.rate;
    }
    logger.error({ err }, 'No USD/INR rate available; international visitors see INR prices');
    return null;
  }
}

/** Converts US cents to INR paise at the given rate, rounded to whole rupees. */
export function centsToPaise(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100) * 100;
}
