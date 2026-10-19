"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

/**
 * Pages Google Analytics never loads on: admin screens, and pages whose URL carries a one-time
 * secret (email sign-in, verification and password-reset links). Those secrets must not be sent
 * to a third party, and since the links open as a fresh page load, GA is simply never present.
 */
const EXCLUDED = ["/admin", "/auth/magic", "/verify-email", "/reset-password"];

const isExcluded = (path: string) => EXCLUDED.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Loads Google Analytics 4 when the admin has turned it on. GA4's enhanced measurement records
 * page changes in the app by itself, so only the initial config is sent here.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  const pathname = usePathname();
  // Decide once per page load: once loaded, GA stays (unloading a script isn't possible).
  const [allowed] = useState(() => !isExcluded(pathname));

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
