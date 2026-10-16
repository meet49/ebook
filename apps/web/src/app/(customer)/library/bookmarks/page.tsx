"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { useBookmarks, type BookmarkItem } from "@/lib/reader";

export default function BookmarksPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
        <p className="text-muted-foreground text-sm">Pages you saved while reading.</p>
      </div>
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn&apos;t load bookmarks</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : groups.size === 0 ? (
        <Empty className="min-h-[40vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bookmark />
            </EmptyMedia>
            <EmptyTitle>No bookmarks yet</EmptyTitle>
            <EmptyDescription>Tap the bookmark icon in the reader to save a page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([slug, items]) => (
            <Card key={slug} className="gap-0 py-0">
              <div className="border-b px-4 py-3 font-medium">{items[0]!.title}</div>
              <ul className="divide-y">
                {items
                  .sort((a, b) => a.page - b.page)
                  .map((b) => (
                    <li key={b.id} className="flex items-center gap-2 px-4 py-2">
                      <Link href={`/read/${slug}?page=${b.page}`} className="hover:text-primary flex-1 text-sm">
                        Page {b.page}
                        {b.label ? <span className="text-muted-foreground"> · {b.label}</span> : null}
                      </Link>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove bookmark on page ${b.page}`} onClick={() => remove.mutate(b.id)}>
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
