"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Bookmark, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntlLocale, useMessages } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { useBookmarks, type BookmarkItem } from "@/lib/reader";

export default function BookmarksPage() {
  const m = useMessages();
  const t = m.library.bookmarks;
  const locale = useIntlLocale();
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useBookmarks();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/me/bookmarks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "bookmarks"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const groups = new Map<string, BookmarkItem[]>();
  for (const b of data ?? []) groups.set(b.slug, [...(groups.get(b.slug) ?? []), b]);

  return (
    <div>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label={m.common.actions.loading}>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : isError ? (
        <Empty className="rounded-3xl border">
          <EmptyHeader>
            <EmptyTitle>{t.loadError}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              {m.common.actions.tryAgain}
            </Button>
          </EmptyContent>
        </Empty>
      ) : groups.size === 0 ? (
        <Empty className="min-h-[40vh] rounded-3xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
              <Bookmark />
            </EmptyMedia>
            <EmptyTitle>{t.emptyTitle}</EmptyTitle>
            <EmptyDescription>{t.emptyBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/library">{t.goToLibrary}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {[...groups.entries()].map(([slug, items]) => (
            <Card key={slug} className="gap-0 rounded-2xl py-0">
              <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <BookOpen className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{items[0]!.title}</h2>
                  <p className="text-muted-foreground text-xs">{t.count(items.length)}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href={`/read/${slug}`}>
                    <span className="hidden sm:inline">{t.openBook}</span>
                    <ArrowRight aria-hidden />
                    <span className="sr-only sm:hidden">{t.openBook}</span>
                  </Link>
                </Button>
              </div>
              <ul className="divide-y">
                {[...items]
                  .sort((a, b) => a.page - b.page)
                  .map((b) => (
                    <li key={b.id} className="flex items-center gap-1 pr-2">
                      <Link
                        href={`/read/${slug}?page=${b.page}`}
                        className="hover:bg-muted/50 focus-visible:bg-muted/50 group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 outline-none sm:px-5"
                      >
                        <span className="bg-accent text-accent-foreground shrink-0 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums">
                          {t.page(b.page)}
                        </span>
                        <span className="min-w-0 flex-1">
                          {b.label ? <span className="block truncate text-sm">{b.label}</span> : null}
                          <span className="text-muted-foreground block text-xs">{t.saved(dateFmt.format(new Date(b.createdAt)))}</span>
                        </span>
                        <ArrowRight
                          className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                          aria-hidden
                        />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t.remove(b.page)}
                        onClick={() => remove.mutate(b.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
