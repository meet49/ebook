"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (a dev service worker would cache stale bundles). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Installability is a progressive enhancement; the site works without it.
    });
  }, []);
  return null;
}
