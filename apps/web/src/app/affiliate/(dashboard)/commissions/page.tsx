"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock, HandCoins } from "lucide-react";
import { useState } from "react";
import { formatINR, type CommissionStatus, type Paginated } from "@ebook/shared";
import { CommissionStatusBadge } from "@/components/affiliate/commission-status";
import { FilterPills, ListCard, Pager } from "@/components/dashboard/list-ui";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMessages } from "@/i18n/client";
import { COMMISSION_STATUS_INFO, type CommissionDto } from "@/lib/affiliate";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export default function AffiliateCommissionsPage() {
  const messages = useMessages();
  const a = messages.affiliate;
  const t = a.commissions;
  const fmt = useAffiliateFormat();
  const [status, setStatus] = useState<CommissionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["affiliate", "commissions", status, page],
    queryFn: () => api<Paginated<CommissionDto>>(`/affiliate/commissions?page=${page}${status !== "all" ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const onHold = (c: CommissionDto) => c.status === "pending" || c.status === "approved";

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={messages.common.dashboard.affiliate.commissions} description={t.description} />
      <ListCard
        toolbar={
          <>
            <FilterPills
              label={t.filterLabel}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all" as const, label: a.common.all },
                ...(Object.keys(COMMISSION_STATUS_INFO) as CommissionStatus[]).map((s) => ({ value: s, label: a.status[s].label })),
              ]}
            />
            {data ? <p className="text-muted-foreground shrink-0 text-sm tabular-nums">{t.total(data.total)}</p> : null}
          </>
        }
      >
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HandCoins />
              </EmptyMedia>
              <EmptyTitle>{status === "all" ? t.emptyTitle : t.emptyFiltered}</EmptyTitle>
              <EmptyDescription>{status === "all" ? t.emptyBody : t.emptyFilteredBody}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            {/* Phones: stacked cards */}
            <ul className="divide-y md:hidden">
              {data.items.map((c) => (
                <li key={c.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.productTitle}</p>
                      <p className="text-muted-foreground text-xs">
                        {fmt.date(c.createdAt)} · <span className="font-mono">{c.orderNumber}</span>
                      </p>
                    </div>
                    <p className={cn("shrink-0 text-base font-semibold tabular-nums", c.status === "reversed" && "text-muted-foreground line-through")}>
                      {formatINR(c.amountPaise)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CommissionStatusBadge status={c.status} />
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {t.sale}: {formatINR(c.baseAmountPaise)} @ {fmt.rate(c.rule)}
                    </p>
                  </div>
                  {onHold(c) ? (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="size-3" aria-hidden /> {t.holdUntil(fmt.date(c.holdUntil))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* Tablets and up: table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t.date}</TableHead>
                  <TableHead>{t.ebook}</TableHead>
                  <TableHead>{t.order}</TableHead>
                  <TableHead>{t.sale}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="pr-4 text-right">{t.commission}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground pl-4">{fmt.date(c.createdAt)}</TableCell>
                    <TableCell className="max-w-56 truncate font-medium">{c.productTitle}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{c.orderNumber}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatINR(c.baseAmountPaise)} <span className="text-muted-foreground text-xs">@ {fmt.rate(c.rule)}</span>
                    </TableCell>
                    <TableCell>
                      <CommissionStatusBadge status={c.status} />
                      {onHold(c) && (
                        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <Clock className="size-3" aria-hidden /> {t.holdUntil(fmt.date(c.holdUntil))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={cn("pr-4 text-right font-semibold tabular-nums", c.status === "reversed" && "text-muted-foreground font-medium line-through")}>
                      {formatINR(c.amountPaise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data ? (
          <Pager
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            labels={{ previous: a.common.previous, next: a.common.next, pageOf: a.common.pageOf(page, totalPages), nav: a.common.pagination }}
          />
        ) : null}
      </ListCard>
    </>
  );
}
