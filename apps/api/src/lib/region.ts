import type { Request } from 'express';

/**
 * The visitor's country (ISO 3166 alpha-2). Vercel adds `x-vercel-ip-country` to requests it
 * proxies; the website also stores it in the `rns_country` cookie. Defaults to India.
 */
export function buyerCountry(req: Request): string {
  const raw = req.header('x-vercel-ip-country') || (req.cookies?.rns_country as string | undefined) || 'IN';
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'IN';
}

/** Visitors outside India see international (USD) prices where a book has one. */
export function isInternational(req: Request): boolean {
  return buyerCountry(req) !== 'IN';
}
