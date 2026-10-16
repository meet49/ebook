"use client";

import Link from "next/link";
import { BookOpen, MailWarning, PlayCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookCover } from "@/components/products/book-cover";
import { ProductGrid } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { useLibrary, type LibraryItem } from "@/lib/reader";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  return Math.abs(days) < 30 ? relative.format(days, "day") : new Date(iso).toLocaleDateString("en-IN");
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress">
      <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function LibraryPage() {
  const { data: user } = useMe();
  const { data, isPending, isError, refetch } = useLibrary();
  const resend = useMutation({
    mutationFn: () => api("/auth/resend-verification", { method: "POST" }),
    onSuccess: () => toast.success("Verification email sent"),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const continueItem = data?.items.find((i) => i.progress && i.readable);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My library</h1>
        <p className="text-muted-foreground text-sm">Your eBooks, ready to read on any device.</p>
      </div>

      {user && !user.emailVerified && (
        <Card className="border-warning/40 bg-warning/5 py-4">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <MailWarning className="text-warning size-5 shrink-0" aria-hidden />
            <p className="flex-1 text-sm">
              Please verify <strong>{user.email}</strong> so we can send receipts and recovery links.
            </p>
            <Button variant="outline" size="sm" onClick={() => resend.mutate()} disabled={resend.isPending}>
              Resend email
            </Button>
          </CardContent>
        </Card>
      )}

      {isPending ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-2/3 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn&apos;t load your library</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {continueItem && <ContinueReading item={continueItem} />}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">My books</h2>
            {data.items.length === 0 ? (
              <Empty className="min-h-[30vh] border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BookOpen />
                  </EmptyMedia>
                  <EmptyTitle>Your library is empty</EmptyTitle>
                  <EmptyDescription>When you buy an eBook it shows up here instantly.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/ebooks">Explore eBooks</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                {data.items.map((item) => (
                  <OwnedBook key={item.productId} item={item} />
                ))}
              </div>
            )}
          </section>

          {data.explore.length > 0 && (
            <section className="space-y-4 border-t pt-10">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Explore more eBooks</h2>
                  <p className="text-muted-foreground text-sm">Add another title to your library.</p>
                </div>
                <Link href="/ebooks" className="text-primary text-sm font-medium hover:underline">
                  View all
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

function ContinueReading({ item }: { item: LibraryItem }) {
  return (
    <Card className="from-accent/60 bg-linear-to-r to-transparent py-4">
      <CardContent className="flex items-center gap-4">
        <BookCover src={item.coverUrl} title={item.title} className="w-16 shrink-0 sm:w-20" sizes="80px" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Continue reading</p>
          <p className="truncate font-semibold">{item.title}</p>
          <div className="flex items-center gap-3">
            <ProgressBar percent={item.progress!.percent} />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              p. {item.progress!.page}/{item.pageCount}
            </span>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/read/${item.slug}`}>
            <PlayCircle /> <span className="hidden sm:inline">Resume</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OwnedBook({ item }: { item: LibraryItem }) {
  const content = (
    <>
      <BookCover src={item.coverUrl} title={item.title} className="transition-transform group-hover:-translate-y-1 group-hover:shadow-xl" />
      <div className="space-y-1.5 px-1">
        <p className="line-clamp-2 leading-snug font-medium">{item.title}</p>
        {item.progress ? (
          <>
            <ProgressBar percent={item.progress.percent} />
            <p className="text-muted-foreground text-xs">
              {item.progress.percent}% · opened {ago(item.progress.lastOpenedAt)}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">{item.readable ? "Not started" : "Being prepared…"}</p>
        )}
      </div>
    </>
  );
  return item.readable ? (
    <Link href={`/read/${item.slug}`} className="group flex flex-col gap-3 rounded-2xl p-2">
      {content}
    </Link>
  ) : (
    <div className="flex flex-col gap-3 p-2 opacity-70">{content}</div>
  );
}
