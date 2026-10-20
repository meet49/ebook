import type { Metadata } from "next";

/** Account pages (sign in, register, password and email links) stay out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return children;
}
