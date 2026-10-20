export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "ReadnShare";
/**
 * Public address of the site, used for absolute links (sitemap, structured data, share images).
 * Set NEXT_PUBLIC_SITE_URL in production; on Vercel the production domain is the fallback.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
export const SUPPORT_EMAIL = "devlineinfotech@gmail.com";

/**
 * The business behind the store, shown on the contact, about and policy pages (payment
 * gateways check these). Set them in Vercel → Settings → Environment Variables and redeploy;
 * anything left empty is simply not shown.
 */
export const BUSINESS = {
  /** Registered or proprietor name, e.g. "Devline Infotech" — must match the payment gateway account. */
  legalName: process.env.NEXT_PUBLIC_BUSINESS_NAME?.trim() || "",
  /** Full postal address on one line. */
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "",
  /** Support phone number with country code, e.g. "+91 98765 43210". */
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim() || "",
  /** Courts for disputes, e.g. "Ahmedabad, Gujarat". Defaults to the courts of India generally. */
  jurisdiction: process.env.NEXT_PUBLIC_BUSINESS_JURISDICTION?.trim() || "",
};

/** "ReadnShare (operated by X)" when a legal name is set, else just the site name. */
export const OPERATOR = BUSINESS.legalName ? `${SITE_NAME} (operated by ${BUSINESS.legalName})` : SITE_NAME;
