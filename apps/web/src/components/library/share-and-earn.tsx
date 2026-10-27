"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, HandCoins, Megaphone, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMessages } from "@/i18n/client";
import { ApiError, api, errorMessage } from "@/lib/api";
import { meQueryKey, useMe } from "@/lib/auth";
import type { LibraryItem } from "@/lib/reader";

interface AffiliateProfileStatus {
  status: "pending" | "approved" | "rejected" | "suspended";
}

/**
 * "Share & earn" in the library: buyers join the affiliate program in one click, then copy or
 * WhatsApp their personal link for any book they own.
 */
export function ShareAndEarn({ books }: { books: LibraryItem[] }) {
  const t = useMessages().library.share;
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAffiliate = Boolean(me?.roles.includes("affiliate"));
  const [accepted, setAccepted] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["affiliate", "me"],
    queryFn: () => api<{ profile: AffiliateProfileStatus }>("/affiliate/me").then((r) => r.profile),
    enabled: isAffiliate,
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => api<{ profile: AffiliateProfileStatus }>("/affiliate/join", { method: "POST", body: { acceptTerms: true } }),
    onSuccess: async ({ profile: p }) => {
      qc.setQueryData(["affiliate", "me"], p);
      await qc.invalidateQueries({ queryKey: meQueryKey });
      toast.success(t.joined);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const shareable = books.filter((b) => b.readable).slice(0, 3);
  if (!shareable.length) return null;
  // Rejected or suspended affiliates (and pending applicants) don't get the card.
  if (isAffiliate && profile && profile.status !== "approved") {
    return profile.status === "pending" ? <p className="text-muted-foreground text-sm">{t.pending}</p> : null;
  }
  const active = isAffiliate && profile?.status === "approved";

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] p-5 text-white sm:p-7" aria-labelledby="share-earn">
      <div aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-white/80 uppercase">
          <Megaphone className="size-3.5" aria-hidden /> {t.eyebrow}
        </p>
        <h2 id="share-earn" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
          {t.title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/80">{active ? t.activeBody : t.body}</p>

        {active ? (
          <>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shareable.map((b) => (
                <ShareRow key={b.productId} book={b} />
              ))}
            </ul>
            <Button asChild variant="secondary" className="mt-5 rounded-full dark:bg-white dark:text-neutral-900">
              <Link href="/affiliate">
                {t.dashboard} <ArrowRight />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {t.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-white/90">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> {p}
                </li>
              ))}
            </ul>
            <label className="mt-5 flex items-start gap-2.5 text-sm text-white/90">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5 border-white/60 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-indigo-700" />
              <span>
                {t.accept}{" "}
                <Link href="/affiliates" target="_blank" className="font-medium underline underline-offset-2">
                  {t.rules}
                </Link>
              </span>
            </label>
            <Button
              variant="secondary"
              size="lg"
              className="mt-4 rounded-full dark:bg-white dark:text-neutral-900"
              disabled={!accepted || join.isPending}
              onClick={() => join.mutate()}
            >
              <HandCoins /> {join.isPending ? t.joining : t.join}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function ShareRow({ book }: { book: LibraryItem }) {
  const t = useMessages().library.share;
  const [url, setUrl] = useState<string | null>(null);
  const link = useMutation({
    mutationFn: () => api<{ link: { url: string } }>("/affiliate/links", { method: "POST", body: { productId: book.productId } }).then((r) => r.link.url),
    onSuccess: setUrl,
  });

  const getUrl = async () => url ?? (await link.mutateAsync());
  const copy = async () => {
    try {
      const u = await getUrl();
      await navigator.clipboard.writeText(u);
      toast.success(t.copied);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.copyFailed);
    }
  };
  const whatsapp = async () => {
    try {
      const u = await getUrl();
      window.open(`https://wa.me/?text=${encodeURIComponent(t.whatsappText(book.title, u))}`, "_blank", "noopener");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <li className="flex gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
      <BookCover src={book.coverUrl} title={book.title} className="w-12 shrink-0" sizes="48px" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{book.title}</p>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" className="h-8 rounded-full px-3 dark:bg-white dark:text-neutral-900" onClick={() => void copy()} disabled={link.isPending}>
            <Copy /> {t.copyLink}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-full px-3 text-white hover:bg-white/15 hover:text-white" onClick={() => void whatsapp()} disabled={link.isPending}>
            <Share2 /> {t.whatsapp}
          </Button>
        </div>
      </div>
    </li>
  );
}
