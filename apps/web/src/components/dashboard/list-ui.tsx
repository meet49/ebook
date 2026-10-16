"use client";

import { ChevronLeft, ChevronRight, Search, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
 * Small, language-agnostic building blocks for dashboard lists (affiliate + admin).
 * Every visible string comes in through props so each portal can pass its own copy.
 */

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Single-choice filter as a row of pills. Scrolls sideways on small screens. */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
  /** Accessible name for the group, e.g. "Filter by status". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
              active
                ? "border-foreground bg-foreground text-background"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count != null ? (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-background/20" : "bg-muted")}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Search input with a leading icon. */
export function SearchField({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
      <Input type="search" className="bg-background h-9 rounded-full pl-9" {...props} />
    </div>
  );
}

/** Rounded list container with an optional toolbar row on top. */
export function ListCard({
  toolbar,
  children,
  className,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden rounded-2xl py-0", className)}>
      {toolbar ? (
        <div className="bg-muted/30 flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">{toolbar}</div>
      ) : null}
      {children}
    </Card>
  );
}

/** Previous / next pager with a "Page x of y" summary. */
export function Pager({
  page,
  totalPages,
  onPage,
  labels,
  summary,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  labels: { previous: string; next: string; pageOf: string; nav: string };
  /** Extra text after the page count, e.g. "120 orders". */
  summary?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-3 border-t px-3 py-3 text-sm sm:px-4">
      <p className="text-muted-foreground">
        {labels.pageOf}
        {summary ? <span className="hidden sm:inline"> · {summary}</span> : null}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden />
          <span className="sr-only sm:not-sr-only">{labels.previous}</span>
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <span className="sr-only sm:not-sr-only">{labels.next}</span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

const PILL_TONES = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
  primary: "border-primary/20 bg-primary/10 text-primary",
  violet: "border-brand-violet/20 bg-brand-violet/10 text-brand-violet",
  muted: "bg-muted text-muted-foreground",
} as const;

export type PillTone = keyof typeof PILL_TONES;

/** Status badge: colour + dot + text, never colour alone. */
export function StatusPill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", PILL_TONES[tone], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

/** Icon in a soft tinted square, for list rows and empty states. */
export function IconChip({ icon: Icon, tone = "primary", className }: { icon: LucideIcon; tone?: PillTone; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border-0", PILL_TONES[tone], className)}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
