"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColumnDatum {
  /** ISO date (YYYY-MM-DD) or label. */
  label: string;
  value: number;
  /** Optional secondary line in the tooltip, e.g. "3 orders". */
  detail?: string;
}

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function prettyLabel(label: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(label) ? dayFmt.format(new Date(`${label}T00:00:00`)) : label;
}

/** A 1-2-5 "nice" ceiling so gridlines land on round numbers. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

/**
 * Single-series column chart (one hue, so no legend — the card title names the series).
 * Thin columns with rounded data-ends, hairline gridlines, a tooltip per column, and a
 * table view for screen readers and anyone who prefers numbers.
 */
export function ColumnChart({
  data,
  format,
  label,
  height = 180,
}: {
  data: ColumnDatum[];
  format: (v: number) => string;
  /** Accessible name, e.g. "Net revenue per day". */
  label: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];
  const empty = data.every((d) => d.value === 0);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="xs" onClick={() => setAsTable((t) => !t)} aria-controls={id}>
          {asTable ? "View chart" : "View as table"}
        </Button>
      </div>

      {asTable ? (
        <div id={id} className="max-h-64 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-3">Date</TableHead>
                <TableHead className="pr-3 text-right">{label}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.label}>
                  <TableCell className="pl-3">{prettyLabel(d.label)}</TableCell>
                  <TableCell className="pr-3 text-right tabular-nums">
                    {format(d.value)}
                    {d.detail ? <span className="text-muted-foreground"> · {d.detail}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <figure id={id} role="group" aria-label={label} className="relative">
          <div className="flex gap-2">
            {/* Y axis labels */}
            <div className="text-muted-foreground relative w-12 shrink-0 text-right text-[11px] tabular-nums" style={{ height }} aria-hidden>
              {ticks.map((t, i) => (
                <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                  {format(t)}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              {/* Hairline gridlines */}
              <div className="pointer-events-none absolute inset-0" style={{ height }} aria-hidden>
                {ticks.map((_, i) => (
                  <div key={i} className="border-border absolute inset-x-0 border-t" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
                ))}
              </div>
              <div className="relative flex items-end" style={{ height }} onMouseLeave={() => setActive(null)}>
                {data.map((d, i) => {
                  const h = max ? (d.value / max) * height : 0;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      className="group relative flex h-full flex-1 cursor-default items-end justify-center px-px outline-none"
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      aria-label={`${prettyLabel(d.label)}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                    >
                      <span
                        className={cn(
                          "bg-primary block w-full max-w-6 rounded-t-[4px] transition-opacity",
                          active !== null && active !== i && "opacity-40",
                          d.value > 0 && "min-h-[2px]",
                        )}
                        style={{ height: h }}
                      />
                      {active === i && (
                        <span
                          role="tooltip"
                          className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full z-10 mb-2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
                          style={{ transform: i > data.length * 0.7 ? "translateX(-40%)" : i < data.length * 0.3 ? "translateX(40%)" : undefined }}
                        >
                          <span className="text-muted-foreground block">{prettyLabel(d.label)}</span>
                          <span className="font-medium tabular-nums">{format(d.value)}</span>
                          {d.detail ? <span className="text-muted-foreground"> · {d.detail}</span> : null}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* X axis labels (sparse to avoid collisions) */}
              <div className="text-muted-foreground mt-1.5 flex text-[11px]" aria-hidden>
                {data.map((d, i) => (
                  <span key={d.label} className="flex-1 truncate text-center">
                    {i % labelEvery === 0 ? prettyLabel(d.label) : ""}
                  </span>
                ))}
              </div>
              {empty && (
                <p className="text-muted-foreground absolute inset-x-0 text-center text-sm" style={{ top: height / 2 - 10 }}>
                  No activity in this period yet
                </p>
              )}
            </div>
          </div>
        </figure>
      )}
    </div>
  );
}
