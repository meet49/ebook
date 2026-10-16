import type { Metadata } from "next";
import { AffiliateShell } from "@/components/layout/portal-shells";

export const metadata: Metadata = { title: { default: "Affiliate", template: "%s · Affiliate" }, robots: { index: false } };

export default function AffiliateLayout({ children }: LayoutProps<"/affiliate">) {
  return <AffiliateShell>{children}</AffiliateShell>;
}
