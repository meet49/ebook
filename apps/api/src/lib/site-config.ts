import { SETTING_KEYS, Setting } from '../models/Setting';

/** What the admin saved for Google Analytics. Not a secret: the ID is public in every page. */
export interface StoredAnalyticsSettings {
  measurementId: string | null;
  enabled: boolean;
}

/** What the admin saved for the Meta (Facebook) Pixel. Also public in every page. */
export interface StoredMetaPixelSettings {
  pixelId: string | null;
  enabled: boolean;
}

/** Settings the public website needs. Only safe-to-publish values belong here. */
export interface PublicSiteConfig {
  analytics: { gaMeasurementId: string | null; metaPixelId: string | null };
}

export const GA_MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;
export const META_PIXEL_ID = /^\d{10,20}$/;

const CACHE_MS = 30_000;
let cache: { value: PublicSiteConfig; at: number } | null = null;

export function invalidateSiteConfig(): void {
  cache = null;
}

export async function getAnalyticsSettings(): Promise<StoredAnalyticsSettings> {
  const stored = (await Setting.findOne({ key: SETTING_KEYS.analytics }))?.value as StoredAnalyticsSettings | undefined;
  return { measurementId: stored?.measurementId ?? null, enabled: Boolean(stored?.enabled) };
}

export async function getMetaPixelSettings(): Promise<StoredMetaPixelSettings> {
  const stored = (await Setting.findOne({ key: SETTING_KEYS.metaPixel }))?.value as StoredMetaPixelSettings | undefined;
  return { pixelId: stored?.pixelId ?? null, enabled: Boolean(stored?.enabled) };
}

/** Cached briefly: the website asks for this on every page render. */
export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const [ga, pixel] = await Promise.all([getAnalyticsSettings(), getMetaPixelSettings()]);
  const value: PublicSiteConfig = {
    analytics: {
      gaMeasurementId: ga.enabled && ga.measurementId && GA_MEASUREMENT_ID.test(ga.measurementId) ? ga.measurementId : null,
      metaPixelId: pixel.enabled && pixel.pixelId && META_PIXEL_ID.test(pixel.pixelId) ? pixel.pixelId : null,
    },
  };
  cache = { value, at: Date.now() };
  return value;
}
