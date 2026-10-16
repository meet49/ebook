"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, BookOpen, BookOpenText, CheckCircle2, Clock, MailWarning, PlayCircle, type LucideIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { BookCover } from "@/components/products/book-cover";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntlLocale, useMessages } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useLibrary, type LibraryItem } from "@/lib/reader";
import { cn } from "@/lib/utils";

/** "today", "2 days ago", "2 दिन पहले"… and a plain date once it's more than a month old. */
function useAgo() {
  const locale = useIntlLocale();
  return useMemo(() => {
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    return (iso: string) => {
      const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
      return Math.abs(days) < 30 ? relative.format(days, "day") : date.format(new Date(iso));
    };
  }, [locale]);
}

function ProgressBar({ percent, label, className }: { percent: number; label: string; className?: string }) {
  return (
    <div
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="bg-gradient-brand h-full rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function LibraryPage() {
  const m = useMessages();
  const t = m.library;
  const { data: user } = useMe();
  const { data, isPending, isError, refetch } = useLibrary();
  const resend = useMutation({
    mutationFn: () => api("/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success(t.home.resent),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const continueItem = data?.items.find((i) => i.progress && i.readable);
  const firstName = user?.name.trim().split(/\s+/)[0];
  const reading = data?.items.filter((i) => i.progress && i.progress.percent < 100).length ?? 0;
  const finished = data?.items.filter((i) => i.progress && i.progress.percent >= 100).length ?? 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">{t.home.eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {firstName ? (
              <>
                {t.home.greeting}{" "}
                <span className="font-display text-gradient-brand pr-1 font-normal italic">{firstName}</span>
              </>
            ) : (
              t.home.greetingFallback
            )}
          </h1>
          <p className="text-muted-foreground text-sm">{t.home.subtitle}</p>
        </div>
        {data && data.items.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            <StatChip icon={BookMarked}>{t.home.stats.books(data.items.length)}</StatChip>
            {reading > 0 && <StatChip icon={BookOpenText}>{t.home.stats.reading(reading)}</StatChip>}
            {finished > 0 && <StatChip icon={CheckCircle2}>{t.home.stats.finished(finished)}</StatChip>}
          </ul>
        ) : null}
      </header>

      {user && !user.emailVerified && (
        <div className="border-warning/40 bg-warning/10 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <span className="bg-warning/15 text-warning flex size-9 shrink-0 items-center justify-center rounded-xl">
            <MailWarning className="size-4.5" aria-hidden />
          </span>
          <p className="flex-1 text-sm">
            {t.home.verifyLead}
            <strong className="break-all">{user.email}</strong>
            {t.home.verifyTail}
          </p>
          <Button variant="outline" size="sm" onClick={() => resend.mutate()} disabled={resend.isPending}>
            {t.home.resend}
          </Button>
        </div>
      )}

      {isPending ? (
        <div className="space-y-10" aria-busy="true" aria-label={m.common.actions.loading}>
          <Skeleton className="h-44 rounded-3xl" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3 p-2">
                <Skeleton className="aspect-2/3 rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <Empty className="rounded-3xl border">
          <EmptyHeader>
            <EmptyTitle>{t.home.loadError}</EmptyTitle>
            <EmptyDescription>{t.home.loadErrorBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              {m.common.actions.tryAgain}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {continueItem && <ContinueReading item={continueItem} />}

          <section className="space-y-5" aria-labelledby="my-books-heading">
            <div className="flex items-baseline gap-2">
              <h2 id="my-books-heading" className="text-xl font-semibold tracking-tight">
                {t.books.title}
              </h2>
              {data.items.length > 0 && (
                <span className="text-muted-foreground text-sm tabular-nums">({data.items.length})</span>
              )}
            </div>
            {data.items.length === 0 ? (
              <EmptyLibrary />
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5">
                {data.items.map((item) => (
                  <OwnedBook key={item.productId} item={item} />
                ))}
              </div>
            )}
          </section>

          {data.explore.length > 0 && (
            <section className="space-y-5 border-t pt-10" aria-labelledby="explore-heading">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <h2 id="explore-heading" className="text-xl font-semibold tracking-tight">
                    {t.explore.title}
                  </h2>
                  <p className="text-muted-foreground text-sm">{t.explore.body}</p>
                </div>
                <Link
                  href="/ebooks"
                  className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
                >
                  {m.common.actions.viewAll}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <ProductGrid products={data.explore} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
      <Icon className="text-primary size-3.5" aria-hidden />
      {children}
    </li>
  );
}

function ContinueReading({ item }: { item: LibraryItem }) {
  const t = useMessages().library;
  const ago = useAgo();
  const progress = item.progress!;
  return (
    <section
      aria-labelledby="continue-heading"
      className="bg-card animate-in fade-in-0 slide-in-from-bottom-2 relative overflow-hidden rounded-3xl border p-5 shadow-sm duration-500 motion-reduce:animate-none sm:p-7"
    >
      <div aria-hidden className="from-accent via-accent/40 absolute inset-0 bg-linear-to-br to-transparent" />
      <div aria-hidden className="bg-brand-violet/15 absolute -top-24 -right-24 size-72 rounded-full blur-3xl" />
      <div className="relative flex gap-5 sm:items-center sm:gap-7">
        <BookCover src={item.coverUrl} title={item.title} alt="" className="w-20 shrink-0 self-start sm:w-28 sm:self-auto" sizes="112px" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <p className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <BookOpenText className="size-3.5" aria-hidden />
              {t.continueReading.eyebrow}
            </p>
            <h2 id="continue-heading" className="line-clamp-2 text-lg font-semibold tracking-tight sm:text-2xl">
              {item.title}
            </h2>
            {item.author ? <p className="text-muted-foreground truncate text-sm">{item.author}</p> : null}
          </div>
          <div className="max-w-md space-y-1.5">
            <ProgressBar percent={progress.percent} label={t.books.progress} className="h-2" />
            <div className="text-muted-foreground flex flex-wrap justify-between gap-x-3 text-xs tabular-nums">
              <span>{t.continueReading.pageOf(progress.page, item.pageCount)}</span>
              <span>{t.continueReading.percent(progress.percent)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/read/${item.slug}`}>
                <PlayCircle aria-hidden />
                {t.continueReading.resume}
              </Link>
            </Button>
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5" aria-hidden />
              {t.continueReading.lastOpened(ago(progress.lastOpenedAt))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function OwnedBook({ item }: { item: LibraryItem }) {
  const t = useMessages().library.books;
  const ago = useAgo();
  const finished = Boolean(item.progress && item.progress.percent >= 100);
  const badge = finished ? (
    <span className="bg-background/90 text-success absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur">
      <CheckCircle2 className="size-3" aria-hidden />
      {t.finished}
    </span>
  ) : item.readable && !item.progress ? (
    <span className="bg-background/90 text-primary absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur">
      {t.new}
    </span>
  ) : null;

  const content = (
    <>
      <div className="relative">
        <BookCover
          src={item.coverUrl}
          title={item.title}
          alt=""
          sizes="(min-width: 1024px) 200px, 45vw"
          className="transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl motion-reduce:transition-none"
        />
        {badge}
      </div>
      <div className="space-y-1.5 px-1">
        <div>
          <p className="line-clamp-2 leading-snug font-medium">{item.title}</p>
          {item.author ? <p className="text-muted-foreground truncate text-xs">{item.author}</p> : null}
        </div>
        {item.progress ? (
          <>
            <ProgressBar percent={item.progress.percent} label={t.progress} />
            <p className="text-muted-foreground text-xs">
              <span className="tabular-nums">{item.progress.percent}%</span> · {t.opened(ago(item.progress.lastOpenedAt))}
            </p>
          </>
        ) : item.readable ? (
          <p className="text-primary inline-flex items-center gap-1 text-xs font-medium">
            {t.startReading}
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{t.preparing}</p>
        )}
      </div>
    </>
  );
  return item.readable ? (
    <Link
      href={`/read/${item.slug}`}
      className="group hover:bg-muted/50 focus-visible:ring-ring/50 flex flex-col gap-3 rounded-2xl p-2 transition-colors outline-none focus-visible:ring-[3px]"
    >
      {content}
    </Link>
  ) : (
    <div className="flex flex-col gap-3 p-2 opacity-70">{content}</div>
  );
}

function EmptyLibrary() {
  const t = useMessages().library.books;
  return (
    <div className="bg-card relative isolate overflow-hidden rounded-3xl border border-dashed px-6 py-14 text-center">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <span className="bg-gradient-brand shadow-primary/20 mx-auto flex size-14 items-center justify-center rounded-2xl text-white shadow-lg">
        <BookOpen className="size-6" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{t.emptyTitle}</h3>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">{t.emptyBody}</p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/ebooks">
          {t.explore}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      <p className="text-muted-foreground mx-auto mt-6 max-w-sm text-xs">{t.emptyHint}</p>
    </div>
  );
}
