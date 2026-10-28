"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isTrackingExcluded } from "./excluded-paths";

const PIXEL_ID = /^\d{10,20}$/;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Loads the Meta (Facebook) Pixel when the admin has turned it on. The Pixel would report every
 * page change in the app by itself, including moves into excluded pages, so that is switched off
 * (disablePushState) and each page change is reported here instead. Without
 * allowDuplicatePageViews the Pixel would drop every PageView after the first one.
 */
export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();
  // Decide once per page load, like Google Analytics: once loaded, the Pixel stays.
  const [allowed] = useState(() => !isTrackingExcluded(pathname));
  const enabled = Boolean(pixelId && PIXEL_ID.test(pixelId) && allowed);
  // The base code reports the first page; the effect reports the pages after it.
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (!enabled || pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (!isTrackingExcluded(pathname)) window.fbq?.("track", "PageView");
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq.disablePushState=true;fbq.allowDuplicatePageViews=true;fbq('init','${pixelId}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- Meta's no-JavaScript fallback is a plain tracking image */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
