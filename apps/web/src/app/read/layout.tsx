import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.reader.meta, robots: { index: false } };
}

/** Distraction-free: no storefront header or footer around the reader. */
export default function ReadLayout({ children }: LayoutProps<"/read">) {
  return <>{children}</>;
}
