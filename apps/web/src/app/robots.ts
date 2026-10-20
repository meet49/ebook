import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Public store pages are crawlable; accounts, checkout, the reader and dashboards are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Book covers and samples are served from the public products API; the rest of /api is not.
        allow: ["/", "/affiliate/apply", "/api/v1/products/"],
        disallow: [
          "/api/",
          "/admin",
          // Trailing slash: blocks the affiliate dashboard but not the /affiliates program page.
          "/affiliate/",
          "/library",
          "/account",
          "/read/",
          "/checkout/",
          "/auth/",
          "/verify-email",
          "/reset-password",
          "/offline",
          "/r/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
