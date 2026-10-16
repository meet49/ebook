"use client";

import type { OrderStatus } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/utils";

const STYLES: Record<OrderStatus, string> = {
  created: "bg-muted text-muted-foreground",
  paid: "bg-success/15 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-warning/15 text-warning border-warning/20",
  partially_refunded: "bg-warning/15 text-warning border-warning/20",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const labels = useMessages().checkout.status;
  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {labels[status]}
    </Badge>
  );
}
