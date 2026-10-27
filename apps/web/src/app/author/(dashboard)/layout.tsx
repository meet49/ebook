import type { Metadata } from "next";
import { AuthorShell } from "@/components/layout/portal-shells";

export const metadata: Metadata = { title: { default: "Author", template: "%s · Author" }, robots: { index: false } };

export default function AuthorLayout({ children }: LayoutProps<"/author">) {
  return <AuthorShell>{children}</AuthorShell>;
}
