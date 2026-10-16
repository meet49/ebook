"use client";

import { UserX } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@ebook/shared";
import { ListCard, SearchField, StatusPill } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { initials } from "@/components/layout/user-menu";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers, useSetUserStatus } from "@/lib/admin";
import { errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

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
      <PageHeader eyebrow="Store" title="Customers" description="Everyone who has an account or bought an eBook." />

      <ListCard
        toolbar={
          <>
            <p className="text-muted-foreground text-sm">{data ? `${data.total.toLocaleString("en-IN")} customers` : " "}</p>
            <SearchField
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              aria-label="Search customers"
              className="lg:max-w-xs"
            />
          </>
        }
      >
        {isError ? (
          <ListError title="Couldn't load customers" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={6} />
        ) : data.items.length === 0 ? (
          <ListEmpty
            icon={UserX}
            title={deferredQ ? "No matching customers" : "No customers yet"}
            description={deferredQ ? "Try a different name or email." : "Customers appear here after they register or purchase."}
          />
        ) : (
          <Table className={cn("min-w-160 transition-opacity", isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={u.emailVerified ? "success" : "muted"}>{u.emailVerified ? "Verified" : "Unverified"}</StatusPill>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={u.status === "active" ? "success" : "destructive"} className="capitalize">
                      {u.status}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateFmt.format(new Date(u.createdAt))}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {u.id !== me?.id && (
                      <Button
                        size="sm"
                        variant={u.status === "active" ? "ghost" : "secondary"}
                        className={u.status === "active" ? "text-destructive hover:text-destructive" : undefined}
                        onClick={() => setTarget(u)}
                      >
                        {u.status === "active" ? "Suspend" : "Reactivate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} summary={`${data.total} customers`} /> : null}
      </ListCard>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspending ? "Suspend" : "Reactivate"} {target?.name}?
            </AlertDialogTitle>
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
