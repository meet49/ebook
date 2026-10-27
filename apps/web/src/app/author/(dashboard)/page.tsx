"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Clock, HandCoins, Library, Plus, Wallet } from "lucide-react";
import { formatINR, type AdminProduct, type AuthorProfileDto } from "@ebook/shared";
import { AuthorGate } from "@/components/author/author-gate";
import { AuthorBookStatus } from "@/components/author/book-status";
import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { useAuthorBooks, useAuthorStats } from "@/lib/author";

export default function AuthorOverviewPage() {
  const m = useMessages();
  const t = m.author.overview;
  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={m.common.dashboard.author.overview}
        description={t.description}
        actions={
          <Button asChild size="lg">
            <Link href="/author/books/new">
              <Plus /> {t.newBook}
            </Link>
          </Button>
        }
      />
      <AuthorGate>{(profile) => <Overview profile={profile} />}</AuthorGate>
    </>
  );
}

function Overview({ profile }: { profile: AuthorProfileDto }) {
  const t = useMessages().author.overview;
  const stats = useAuthorStats();
  const books = useAuthorBooks();
  const s = stats.data;

  return (
    <div className="space-y-8">
      <p className="bg-primary/5 border-primary/20 rounded-2xl border p-4 text-sm">{t.share(profile.sharePercent)}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.stats.books} icon={Library} tone="primary" loading={stats.isPending} value={s?.books.total} hint={s ? `${t.stats.live}: ${s.books.published} · ${t.stats.inReview}: ${s.books.inReview}` : undefined} />
        <StatTile label={t.stats.sales} icon={BookOpen} tone="violet" loading={stats.isPending} value={s?.sales} />
        <StatTile label={t.stats.pending} icon={Clock} tone="warning" loading={stats.isPending} value={s ? formatINR(s.earnings.pendingPaise) : undefined} hint={t.holdNote} />
        <StatTile
          label={t.stats.payable}
          icon={Wallet}
          tone="success"
          loading={stats.isPending}
          value={s ? formatINR(s.earnings.payablePaise) : undefined}
          hint={s ? `${t.stats.paid}: ${formatINR(s.earnings.paidPaise)}` : undefined}
        />
      </div>

      <section className="space-y-4" aria-labelledby="books-heading">
        <h2 id="books-heading" className="text-lg font-semibold tracking-tight">
          {t.booksTitle}
        </h2>
        {books.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !books.data?.length ? (
          <Empty className="bg-card rounded-2xl border border-solid">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HandCoins />
              </EmptyMedia>
              <EmptyTitle>{t.emptyTitle}</EmptyTitle>
              <EmptyDescription>{t.emptyBody}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/author/books/new">
                  <Plus /> {t.newBook}
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Card className="gap-0 overflow-hidden rounded-2xl py-0">
            <ul className="divide-y">
              {books.data.map((b) => (
                <BookRow key={b.id} book={b} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function BookRow({ book: b }: { book: AdminProduct }) {
  const t = useMessages().author.overview;
  return (
    <li>
      <Link href={`/author/books/${b.id}`} className="hover:bg-muted/50 flex items-center gap-4 p-4 transition-colors">
        <BookCover src={b.coverUrl} title={b.title} className="w-12 shrink-0 rounded-md" sizes="48px" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block truncate font-medium">{b.title}</span>
          <span className="flex flex-wrap items-center gap-2">
            <AuthorBookStatus status={b.status} />
            {b.reviewNote && b.status === "draft" ? <span className="text-warning text-xs font-medium">{t.changesRequested}</span> : null}
            <span className="text-muted-foreground text-xs tabular-nums">{formatINR(b.effectivePricePaise)}</span>
          </span>
        </span>
        <span className="text-primary hidden text-sm font-medium sm:inline">{t.edit}</span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}
