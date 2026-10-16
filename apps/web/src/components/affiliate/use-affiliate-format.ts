"use client";

import { useMemo } from "react";
import type { CommissionType } from "@ebook/shared";
import { useIntlLocale } from "@/i18n/client";

/** Locale-aware number, date and commission-rate formatting for the affiliate portal. */
export function useAffiliateFormat() {
  const locale = useIntlLocale();
  return useMemo(() => {
    const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    const num = new Intl.NumberFormat(locale);
    return {
      locale,
      date: (iso: string) => dateFmt.format(new Date(iso)),
      number: (n: number) => num.format(n),
      /** "10%" or "₹50" — the rule's headline value. */
      rate: (rule: { type: CommissionType; value: number }) =>
        rule.type === "percent"
          ? `${(rule.value / 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
          : `₹${(rule.value / 100).toLocaleString(locale)}`,
    };
  }, [locale]);
}
