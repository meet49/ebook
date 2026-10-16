"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";
import { BookReader } from "@/components/reader/book-reader";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { useManifest } from "@/lib/reader";

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

  if (isPending) return <Loading />;
  if (error) {
    const notOwned = error instanceof ApiError && error.status === 403;
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Empty className="min-h-dvh">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>{notOwned ? "This eBook isn't in your library" : missing ? "eBook not found" : "Couldn't open this eBook"}</EmptyTitle>
          <EmptyDescription>
            {notOwned ? "Buy it to start reading, or sign in with the account you used to purchase it." : missing ? "It may have been removed." : "Please check your connection and try again."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button asChild variant="outline">
            <Link href="/library">My library</Link>
          </Button>
          {notOwned ? (
            <Button asChild>
              <Link href={`/ebooks/${slug}`}>View eBook</Link>
            </Button>
          ) : !missing ? (
            <Button onClick={() => refetch()}>Try again</Button>
          ) : null}
        </EmptyContent>
      </Empty>
    );
  }
  const startPage = Number.isInteger(requested) && requested >= 1 && requested <= data.pageCount ? requested : data.progress.page;
  return <BookReader manifest={data} startPage={startPage} />;
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-sm" role="status">
      <Spinner /> Opening your book…
    </div>
  );
}
