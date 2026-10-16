"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { BookOpen, Lock, SearchX, WifiOff } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";
import { BookReader } from "@/components/reader/book-reader";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { ApiError } from "@/lib/api";
import { usePdfDocument } from "@/lib/pdf-client";
import { useManifest, type ReaderManifest } from "@/lib/reader";

export default function ReadPage() {
  return (
    <RoleGate portal="customer" fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <Reader />
      </Suspense>
    </RoleGate>
  );
}

function Reader() {
  const { slug } = useParams<{ slug: string }>();
  const requested = Number(useSearchParams().get("page"));
  const { data, isPending, error, refetch } = useManifest(slug);
  const m = useMessages();
  const t = m.reader;

  if (isPending) return <Loading />;
  if (error) {
    const notOwned = error instanceof ApiError && error.status === 403;
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Empty className="bg-background min-h-dvh">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
            {notOwned ? <Lock /> : missing ? <SearchX /> : <WifiOff />}
          </EmptyMedia>
          <EmptyTitle>{notOwned ? t.notOwnedTitle : missing ? t.missingTitle : t.errorTitle}</EmptyTitle>
          <EmptyDescription>{notOwned ? t.notOwnedBody : missing ? t.missingBody : t.errorBody}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button asChild variant="outline">
            <Link href="/library">{t.myLibrary}</Link>
          </Button>
          {notOwned ? (
            <Button asChild>
              <Link href={`/ebooks/${slug}`}>{t.viewEbook}</Link>
            </Button>
          ) : !missing ? (
            <Button onClick={() => refetch()}>{m.common.actions.tryAgain}</Button>
          ) : null}
        </EmptyContent>
      </Empty>
    );
  }
  const startPage = Number.isInteger(requested) && requested >= 1 && requested <= data.pageCount ? requested : data.progress.page;
  return <LoadedBook manifest={data} startPage={startPage} />;
}

/** Downloads the buyer's personal copy (stamped on first open) and hands it to the reader. */
function LoadedBook({ manifest, startPage }: { manifest: ReaderManifest; startPage: number }) {
  const headers = useMemo(() => ({ [manifest.readerHeader]: "1" }), [manifest.readerHeader]);
  const { doc, error } = usePdfDocument(manifest.bookUrl, headers);
  const m = useMessages();
  if (error) {
    return (
      <Empty className="bg-background min-h-dvh">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <WifiOff />
          </EmptyMedia>
          <EmptyTitle>{m.reader.errorTitle}</EmptyTitle>
          <EmptyDescription>{error.message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button asChild variant="outline">
            <Link href="/library">{m.reader.myLibrary}</Link>
          </Button>
          <Button onClick={() => window.location.reload()}>{m.common.actions.tryAgain}</Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (!doc) return <Loading label={m.reader.preparing} />;
  return <BookReader manifest={manifest} startPage={startPage} doc={doc} />;
}

function Loading({ label }: { label?: string }) {
  const t = useMessages().reader;
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center" role="status">
      <span className="bg-gradient-brand shadow-primary/20 flex size-14 animate-pulse items-center justify-center rounded-2xl text-white shadow-lg motion-reduce:animate-none">
        <BookOpen className="size-6" aria-hidden />
      </span>
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> {label ?? t.opening}
      </p>
    </div>
  );
}
