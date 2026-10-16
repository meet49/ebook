"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { LOCALE_COOKIE, intlLocale, type Locale } from "./config";
import { messages, type Messages } from "./messages";

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void } | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState(initialLocale);
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setState(next);
      // Server-rendered pages (catalogue, product pages) re-render in the new language.
      router.refresh();
    },
    [router],
  );
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("I18nProvider is missing");
  return ctx;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useSetLocale(): (l: Locale) => void {
  return useLocaleContext().setLocale;
}

/** All UI strings in the current language, e.g. `const t = useMessages(); t.common.signIn`. */
export function useMessages(): Messages {
  return messages[useLocaleContext().locale];
}

/** Intl tag ("en-IN" / "hi-IN") for number and date formatting. */
export function useIntlLocale(): string {
  return intlLocale(useLocaleContext().locale);
}
