import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { getMessages } from "@/i18n/server";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** Shown by the service worker when a page can't load without a connection. */
export default async function OfflinePage() {
  const t = (await getMessages()).common.offline;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <span className="bg-accent text-accent-foreground flex size-16 items-center justify-center rounded-2xl">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p className="text-muted-foreground max-w-sm">{t.body}</p>
      <RetryButton label={t.retry} />
    </main>
  );
}
