import type { ProcessingStatus, ProductStatus } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<ProductStatus, string> = {
  published: "bg-success/15 text-success border-success/20",
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-primary/10 text-primary border-primary/20",
  unpublished: "bg-warning/15 text-warning border-warning/20",
  archived: "bg-muted text-muted-foreground line-through",
};

export function ProductStatusBadge({ status, processing }: { status: ProductStatus; processing?: ProcessingStatus }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" className={cn("capitalize", STYLES[status])}>
        {status === "in_review" ? "In review" : status}
      </Badge>
      {(processing === "queued" || processing === "processing") && <Badge variant="secondary">Processing PDF</Badge>}
      {processing === "failed" && <Badge variant="destructive">PDF failed</Badge>}
    </span>
  );
}
