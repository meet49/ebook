import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:5000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Dashboards are client-rendered with TanStack Query; storefront pages use classic
  // server rendering. Cache Components can be adopted later route by route.
  cacheComponents: false,
  transpilePackages: ["@ebook/shared"],
  experimental: {
    // proxy.ts never matches /api, but if it ever did, large PDF uploads must not be truncated
    // at the 10MB default. Keep in line with the API's MAX_PDF_MB.
    proxyClientMaxBodySize: "210mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only ever talks to this origin. /api/* is proxied to the Express API so
  // the session cookie stays first-party and no CORS is needed.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      // Affiliate referral links: the API records the click, sets the referral cookie and redirects.
      { source: "/r/:code", destination: `${apiUrl}/api/v1/r/:code` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
