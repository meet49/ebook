"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { useDeferredValue, useState } from "react";
import type { Paginated } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  entity: { type: string; id: string | null } | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
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

  return (
    <>
      <PageHeader title="Audit log" description="Security and administrative events. Entries cannot be edited or deleted from the app." />
      <Input
        value={action}
        onChange={(e) => { setAction(e.target.value); setPage(1); }}
        placeholder="Filter by action prefix, e.g. auth. or payout."
        className="mb-4 max-w-sm"
        aria-label="Filter by action"
      />
      <Card className="overflow-hidden py-0">
        {isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileClock /></EmptyMedia>
              <EmptyTitle>No events</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
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
                  <TableCell className="pl-4 text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="text-sm">{e.actor ?? "system"}</TableCell>
                  <TableCell className="text-xs">{e.entity ? `${e.entity.type} ${e.entity.id?.slice(-6) ?? ""}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-80 truncate pr-4 font-mono text-xs" title={e.meta ? JSON.stringify(e.meta) : undefined}>
                    {e.meta ? JSON.stringify(e.meta) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {data && data.total > data.pageSize && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
