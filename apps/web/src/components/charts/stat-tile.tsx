import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-primary/10 text-primary",
  violet: "bg-brand-violet/10 text-brand-violet",
  success: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  muted: "bg-muted text-muted-foreground",
} as const;

export type StatTone = keyof typeof TONES;

/** A single headline number: when the data's job is "one figure", a tile beats a chart. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  /** Colour of the icon chip. Text always stays in the neutral text colours. */
  tone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-5 transition-shadow hover:shadow-md", className)}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          {Icon ? (
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
              <Icon className="size-4.5" aria-hidden />
            </span>
          ) : null}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]">{value}</p>
        )}
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
