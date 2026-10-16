"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Pager } from "@/components/dashboard/list-ui";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/** English pager for the admin lists. */
export function AdminPager({ page, totalPages, onPage, summary }: { page: number; totalPages: number; onPage: (p: number) => void; summary?: string }) {
  return (
    <Pager
      page={page}
      totalPages={totalPages}
      onPage={onPage}
      summary={summary}
      labels={{ previous: "Previous", next: "Next", pageOf: `Page ${page} of ${totalPages}`, nav: "Pagination" }}
    />
  );
}

export function ListSkeleton({ rows = 5, height = "h-12" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}

export function ListEmpty({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <Empty className="py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}

export function ListError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Empty className="py-14">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
