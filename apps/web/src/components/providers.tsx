"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { RegionProvider } from "@/lib/region-client";

export function Providers({ locale, international, children }: { locale: Locale; international: boolean; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RegionProvider international={international}>
        <I18nProvider initialLocale={locale}>
          {/* Follows the device setting until the visitor picks light or dark. */}
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster richColors position="top-center" />
              <RegisterServiceWorker />
            </TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
      </RegionProvider>
    </QueryClientProvider>
  );
}
