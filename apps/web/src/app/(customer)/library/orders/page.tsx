"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ScrollText } from "lucide-react";
import { useMemo } from "react";
import { formatINR, type OrderStatus } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIntlLocale, useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import type { CustomerOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<OrderStatus, string> = {
  created: "bg-muted text-muted-foreground",
  paid: "bg-success/15 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-warning/15 text-warning border-warning/20",
  partially_refunded: "bg-warning/15 text-warning border-warning/20",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const labels = useMessages().library.orders.status;
  return (
    <Badge variant="outline" className={cn(STATUS_TONE[status])}>
      {labels[status]}
    </Badge>
  );
}

const canRead = (o: CustomerOrder) => o.status === "paid" || o.status === "partially_refunded";

export default function OrdersPage() {
  const m = useMessages();
  const t = m.library.orders;
  const locale = useIntlLocale();
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["me", "orders"],
    queryFn: () => api<{ items: CustomerOrder[] }>("/me/orders").then((r) => r.items),
  });

  return (
    <div>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={data && data.length > 0 ? `${t.description} · ${t.count(data.length)}` : t.description}
      />
      {isPending ? (
        <Skeleton className="h-56 rounded-2xl" aria-busy="true" aria-label={m.common.actions.loading} />
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
      ) : data.length === 0 ? (
        <Empty className="min-h-[40vh] rounded-3xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>{t.emptyTitle}</EmptyTitle>
            <EmptyDescription>{t.emptyBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/ebooks">{t.explore}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {/* Phones: one card per order. */}
          <ul className="space-y-3 md:hidden">
            {data.map((o) => (
              <li key={o.orderNumber} className="bg-card space-y-3 rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="leading-snug font-medium">{o.product.title}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">{o.orderNumber}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-end justify-between gap-3 border-t pt-3">
                  <p className="text-muted-foreground text-xs">{dateFmt.format(new Date(o.paidAt ?? o.createdAt))}</p>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatINR(o.amountPaise)}</p>
                    {o.refundedPaise > 0 && (
                      <p className="text-muted-foreground text-xs tabular-nums">{t.refunded(formatINR(o.refundedPaise))}</p>
                    )}
                  </div>
                </div>
                {canRead(o) && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/read/${o.product.slug}`}>
                      <BookOpen aria-hidden />
                      {t.read}
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {/* Larger screens: a table. */}
          <Card className="hidden overflow-hidden rounded-2xl py-0 md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="pl-5">{t.columns.ebook}</TableHead>
                  <TableHead>{t.columns.order}</TableHead>
                  <TableHead>{t.columns.date}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead className="pr-5 text-right">{t.columns.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.orderNumber}>
                    <TableCell className="py-3.5 pl-5 font-medium">
                      {canRead(o) ? (
                        <Link href={`/read/${o.product.slug}`} className="hover:text-primary inline-flex items-center gap-2">
                          <BookOpen className="text-primary size-4 shrink-0" aria-hidden />
                          {o.product.title}
                        </Link>
                      ) : (
                        o.product.title
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{o.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{dateFmt.format(new Date(o.paidAt ?? o.createdAt))}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {formatINR(o.amountPaise)}
                      {o.refundedPaise > 0 && (
                        <div className="text-muted-foreground text-xs">{t.refunded(formatINR(o.refundedPaise))}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
