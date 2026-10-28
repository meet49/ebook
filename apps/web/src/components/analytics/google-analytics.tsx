"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isTrackingExcluded } from "./excluded-paths";

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

/**
 * Loads Google Analytics 4 when the admin has turned it on. GA4's enhanced measurement records
 * page changes in the app by itself, so only the initial config is sent here.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  const pathname = usePathname();
  // Decide once per page load: once loaded, GA stays (unloading a script isn't possible).
  const [allowed] = useState(() => !isTrackingExcluded(pathname));

  if (!measurementId || !MEASUREMENT_ID.test(measurementId) || !allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`}
      </Script>
    </>
  );
}
