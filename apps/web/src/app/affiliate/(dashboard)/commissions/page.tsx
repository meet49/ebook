"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { useState } from "react";
import { formatINR, type CommissionStatus, type Paginated } from "@ebook/shared";
import { CommissionStatusBadge } from "@/components/affiliate/commission-status";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMISSION_STATUS_INFO, commissionLabel, type CommissionDto } from "@/lib/affiliate";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function AffiliateCommissionsPage() {
  const [status, setStatus] = useState<CommissionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["affiliate", "commissions", status, page],
    queryFn: () => api<Paginated<CommissionDto>>(`/affiliate/commissions?page=${page}${status !== "all" ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Commissions" description="Your commission ledger. Each verified sale earns one entry." />
      <Tabs value={status} onValueChange={(v) => { setStatus(v as CommissionStatus | "all"); setPage(1); }} className="mb-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {(Object.keys(COMMISSION_STATUS_INFO) as CommissionStatus[]).map((s) => (
            <TabsTrigger key={s} value={s}>
              {COMMISSION_STATUS_INFO[s].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card className="overflow-hidden py-0">
        {isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HandCoins />
              </EmptyMedia>
              <EmptyTitle>No commissions yet</EmptyTitle>
              <EmptyDescription>When someone buys through your link, the commission appears here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>eBook</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">{dateFmt.format(new Date(c.createdAt))}</TableCell>
                  <TableCell className="max-w-48 truncate">{c.productTitle}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{c.orderNumber}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatINR(c.baseAmountPaise)} <span className="text-muted-foreground text-xs">@ {commissionLabel(c.rule)}</span>
                  </TableCell>
                  <TableCell>
                    <CommissionStatusBadge status={c.status} />
                    {(c.status === "pending" || c.status === "approved") && (
                      <div className="text-muted-foreground mt-1 text-xs">hold until {dateFmt.format(new Date(c.holdUntil))}</div>
                    )}
                  </TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium tabular-nums", c.status === "reversed" && "text-muted-foreground line-through")}>
                    {formatINR(c.amountPaise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
