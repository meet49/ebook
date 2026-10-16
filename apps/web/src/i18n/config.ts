export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
/** Readable by both the server (to render the right language) and the browser (to switch it). */
export const LOCALE_COOKIE = "rns_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  hi: { short: "हिं", name: "हिन्दी" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl number, date and relative-time formatting. */
export function intlLocale(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}
