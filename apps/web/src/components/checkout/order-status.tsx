import type { OrderStatus } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<OrderStatus, { label: string; className: string }> = {
  created: { label: "Awaiting payment", className: "bg-muted text-muted-foreground" },
  paid: { label: "Paid", className: "bg-success/15 text-success border-success/20" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Refunded", className: "bg-warning/15 text-warning border-warning/20" },
  partially_refunded: { label: "Partly refunded", className: "bg-warning/15 text-warning border-warning/20" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = LABELS[status];
  return (
    <Badge variant="outline" className={cn(s.className)}>
      {s.label}
    </Badge>
  );
}
