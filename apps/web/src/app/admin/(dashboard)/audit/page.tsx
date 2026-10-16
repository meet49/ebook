"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileClock, Lock } from "lucide-react";
import { useDeferredValue, useState } from "react";
import type { Paginated } from "@ebook/shared";
import { ListCard, SearchField } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListSkeleton } from "../_components/admin-list";

interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  entity: { type: string; id: string | null } | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const PREFIXES = ["auth.", "order.", "payout.", "commission.", "affiliate.", "product.", "admin.", "settings."];

/** Colour the action by its area so related events are easy to scan (the text always names it). */
function actionTone(action: string): string {
  if (action.startsWith("auth.")) return "bg-primary/10 text-primary";
  if (action.startsWith("payout.") || action.startsWith("commission.")) return "bg-success/10 text-success";
  if (action.startsWith("affiliate.")) return "bg-brand-violet/10 text-brand-violet";
  if (action.startsWith("order.") || action.startsWith("admin.")) return "bg-warning/10 text-warning";
  return "bg-muted text-foreground";
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(action.trim());
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["admin", "audit", deferred, page],
    queryFn: () => api<Paginated<AuditEntry>>(`/admin/audit?page=${page}${deferred ? `&action=${encodeURIComponent(deferred)}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Audit log"
        description="Security and administrative events. Entries cannot be edited or deleted from the app."
        actions={
          <span className="text-muted-foreground bg-card inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
            <Lock className="size-3.5" aria-hidden /> Read-only
          </span>
        }
      />

      <ListCard
        toolbar={
          <>
            <SearchField
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by action prefix, e.g. auth. or payout."
              aria-label="Filter by action"
              className="lg:max-w-sm"
            />
            <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-1.5">
              {PREFIXES.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={action === p}
                  onClick={() => {
                    setAction(action === p ? "" : p);
                    setPage(1);
                  }}
                  className={cn(
                    "focus-visible:ring-ring/50 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors outline-none focus-visible:ring-3",
                    action === p ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        }
      >
        {isPending ? (
          <ListSkeleton rows={6} height="h-10" />
        ) : !data?.items.length ? (
          <ListEmpty icon={FileClock} title="No events" description={deferred ? "No events match this filter." : undefined} />
        ) : (
          <Table className={cn("min-w-200 transition-opacity", isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="pr-4">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground pl-4 text-xs whitespace-nowrap tabular-nums">{new Date(e.createdAt).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs", actionTone(e.action))}>{e.action}</span>
                  </TableCell>
                  <TableCell className="text-sm">{e.actor ?? <span className="text-muted-foreground">system</span>}</TableCell>
                  <TableCell className="text-xs">
                    {e.entity ? (
                      <>
                        {e.entity.type} <span className="text-muted-foreground font-mono">{e.entity.id?.slice(-6) ?? ""}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-80 truncate pr-4 font-mono text-xs" title={e.meta ? JSON.stringify(e.meta) : undefined}>
                    {e.meta ? JSON.stringify(e.meta) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} /> : null}
      </ListCard>
    </>
  );
}
