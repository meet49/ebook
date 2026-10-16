"use client";

import { Search, UserX } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers, useSetUserStatus } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";

const PAGE_SIZE = 20;
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const deferredQ = useDeferredValue(q.trim());
  const { data, isPending, isError, refetch, isPlaceholderData } = useAdminUsers({
    q: deferredQ || undefined,
    role: "customer",
    page,
    pageSize: PAGE_SIZE,
  });
  const [target, setTarget] = useState<PublicUser | null>(null);
  const setStatus = useSetUserStatus();
  const { data: me } = useMe();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const suspending = target?.status === "active";

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has an account or bought an eBook." />

      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or email"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      <Card className="overflow-hidden py-0">
        {isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Couldn&apos;t load customers</EmptyTitle>
              <EmptyDescription>
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserX />
              </EmptyMedia>
              <EmptyTitle>{deferredQ ? "No matching customers" : "No customers yet"}</EmptyTitle>
              <EmptyDescription>
                {deferredQ ? "Try a different name or email." : "Customers appear here after they register or purchase."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead>Email status</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.emailVerified ? "secondary" : "outline"}>
                      {u.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "secondary" : "destructive"} className="capitalize">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt.format(new Date(u.createdAt))}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {u.id !== me?.id && (
                      <Button size="sm" variant={u.status === "active" ? "outline" : "secondary"} onClick={() => setTarget(u)}>
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {data.total} customers
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{suspending ? "Suspend" : "Reactivate"} {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {suspending
                ? "They will be signed out everywhere and won't be able to sign in or read their books until reactivated."
                : "They will be able to sign in and read their purchased books again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={suspending ? "destructive" : "default"}
              onClick={() => {
                if (!target) return;
                setStatus.mutate(
                  { id: target.id, status: suspending ? "suspended" : "active" },
                  {
                    onSuccess: () => toast.success(suspending ? "Customer suspended" : "Customer reactivated"),
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                );
              }}
            >
              {suspending ? "Suspend" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
