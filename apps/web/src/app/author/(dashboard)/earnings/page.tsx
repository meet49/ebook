"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";
import { formatINR, type AuthorEarningStatus } from "@ebook/shared";
import { AuthorGate } from "@/components/author/author-gate";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { ListCard, Pager, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMessages } from "@/i18n/client";
import { useAuthorEarnings } from "@/lib/author";

const TONE: Record<AuthorEarningStatus, PillTone> = { pending: "warning", payable: "primary", paid: "success", reversed: "muted" };

export default function AuthorEarningsPage() {
  const t = useMessages().author.earnings;
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <AuthorGate>{() => <EarningsList />}</AuthorGate>
    </>
  );
}

function EarningsList() {
  const m = useMessages();
  const t = m.author.earnings;
  const fmt = useAffiliateFormat();
  const [page, setPage] = useState(1);
  const { data, isPending } = useAuthorEarnings(page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (!data?.items.length) {
    return (
      <Empty className="bg-card rounded-2xl border border-solid">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet />
          </EmptyMedia>
          <EmptyTitle>{t.emptyTitle}</EmptyTitle>
          <EmptyDescription>{t.emptyBody}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ListCard>
      <Table className="min-w-160">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{t.date}</TableHead>
            <TableHead>{t.books}</TableHead>
            <TableHead>{t.order}</TableHead>
            <TableHead className="text-right">{t.amount}</TableHead>
            <TableHead className="pr-4 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="pl-4 whitespace-nowrap">{fmt.date(e.createdAt)}</TableCell>
              <TableCell>
                {e.books.map((b) => (
                  <span key={b.title} className="block max-w-64 truncate">
                    {b.title} <span className="text-muted-foreground text-xs tabular-nums">({formatINR(b.pricePaise)})</span>
                  </span>
                ))}
              </TableCell>
              <TableCell className="font-mono text-xs">{e.orderNumber}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatINR(e.amountPaise)}</TableCell>
              <TableCell className="pr-4 text-right">
                <StatusPill tone={TONE[e.status]}>{t.status[e.status] ?? e.status}</StatusPill>
                {e.status === "pending" ? <div className="text-muted-foreground mt-1 text-xs">{t.holdUntil(fmt.date(e.holdUntil))}</div> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        labels={{ previous: "‹", next: "›", pageOf: `${page} / ${totalPages}`, nav: t.title }}
      />
    </ListCard>
  );
}
