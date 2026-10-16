import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reader", robots: { index: false } };

/** Distraction-free: no storefront header or footer around the reader. */
export default function ReadLayout({ children }: LayoutProps<"/read">) {
  return <>{children}</>;
}
