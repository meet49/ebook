import "server-only";
import type { FeaturedOffer, MembershipOverview, Paginated, ProductDetail, ProductSummary } from "@ebook/shared";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:5000";

/**
 * Server-side fetch from the Express API for storefront pages (SEO-friendly server rendering).
 * Responses are reused for 30 seconds, like the API's own cache headers allow, so busy pages
 * don't call the API (and spend its bandwidth) on every view. Returns null for 404 so pages can
 * render notFound().
 */
async function serverGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}/api/v1${path}`, { next: { revalidate: 30 }, headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export interface CatalogParams {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  featured?: boolean;
}

export async function getCatalog(params: CatalogParams): Promise<Paginated<ProductSummary>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return (await serverGet<Paginated<ProductSummary>>(`/products?${search}`)) ?? { items: [], page: 1, pageSize: 12, total: 0 };
}

export async function getCategories(): Promise<string[]> {
  return (await serverGet<{ categories: string[] }>("/products/categories"))?.categories ?? [];
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return (await serverGet<{ product: ProductDetail }>(`/products/${slug}`))?.product ?? null;
}

/** Membership plans and the books they include; null if the API can't be reached. */
export async function getMembership(): Promise<MembershipOverview | null> {
  return serverGet<MembershipOverview>("/membership").catch(() => null);
}

/** The coupon advertised on the home page, if one can be used now. Never breaks a page. */
export async function getFeaturedOffer(): Promise<FeaturedOffer | null> {
  return serverGet<{ offer: FeaturedOffer | null }>("/coupons/featured")
    .then((r) => r?.offer ?? null)
    .catch(() => null);
}

export interface SiteConfig {
  analytics: { gaMeasurementId: string | null; metaPixelId: string | null };
}

/**
 * Public settings managed from the admin panel (e.g. the Google Analytics ID). Cached for a
 * minute, and never allowed to slow down or break a page: on any error the site renders
 * without them.
 */
export async function getSiteConfig(): Promise<SiteConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/site-config`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? ((await res.json()) as SiteConfig) : null;
  } catch {
    return null;
  }
}
