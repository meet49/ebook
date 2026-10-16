import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** A single headline number: when the data's job is "one figure", a tile beats a chart. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          {label}
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
        </div>
        {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>}
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
