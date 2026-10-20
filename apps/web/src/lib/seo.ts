import { SITE_NAME, SITE_URL, SUPPORT_EMAIL } from "./site";

/** Absolute URL on the public site, for sitemaps, structured data and share images. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

/**
 * Serialises structured data for a <script type="application/ld+json"> tag. "<" is escaped so
 * text from product data can never close the script tag.
 */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const organizationLd = {
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: SITE_NAME,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icons/icon-512.png"),
  email: SUPPORT_EMAIL,
};
