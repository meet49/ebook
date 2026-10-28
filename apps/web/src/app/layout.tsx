import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Noto_Sans_Devanagari } from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { Providers } from "@/components/providers";
import { getLocale } from "@/i18n/server";
import { isInternationalVisitor } from "@/lib/region-server";
import { getSiteConfig } from "@/lib/server-api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Geist has no Devanagari glyphs; Hindi text falls back to Noto Sans Devanagari.
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const serif = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: { default: `${SITE_NAME} — Practical eBooks you can read anywhere`, template: `%s · ${SITE_NAME}` },
  description: "Buy practical, expert-written eBooks and read them instantly in a beautiful online reader.",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14131c" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, siteConfig, international] = await Promise.all([getLocale(), getSiteConfig(), isInternationalVisitor()]);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${devanagari.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers locale={locale} international={international}>
          {children}
        </Providers>
        <GoogleAnalytics measurementId={siteConfig?.analytics.gaMeasurementId ?? null} />
        <MetaPixel pixelId={siteConfig?.analytics.metaPixelId ?? null} />
      </body>
    </html>
  );
}
