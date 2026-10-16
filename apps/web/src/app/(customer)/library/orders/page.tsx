"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { formatINR } from "@ebook/shared";
import { OrderStatusBadge } from "@/components/checkout/order-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { CustomerOrder } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function OrdersPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["me", "orders"],
    queryFn: () => api<{ items: CustomerOrder[] }>("/me/orders").then((r) => r.items),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Order history</h1>
        <p className="text-muted-foreground text-sm">Your purchases and refunds.</p>
      </div>
      {isPending ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn&apos;t load your orders</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="min-h-[40vh] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>No orders yet</EmptyTitle>
            <EmptyDescription>Your purchases will be listed here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/ebooks">Explore eBooks</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">eBook</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={o.orderNumber}>
                  <TableCell className="pl-4 font-medium">
                    {o.status === "paid" || o.status === "partially_refunded" ? (
                      <Link href={`/read/${o.product.slug}`} className="hover:underline">
                        {o.product.title}
                      </Link>
                    ) : (
                      o.product.title
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt.format(new Date(o.paidAt ?? o.createdAt))}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatINR(o.amountPaise)}
                    {o.refundedPaise > 0 && <div className="text-muted-foreground text-xs">−{formatINR(o.refundedPaise)} refunded</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
