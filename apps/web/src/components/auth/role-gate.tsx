"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { Portal, Role } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { PORTAL_LOGIN, hasRole, useLogout, useMe } from "@/lib/auth";

const ROLE_FOR_PORTAL: Record<Portal, Role> = { customer: "customer", affiliate: "affiliate", admin: "admin" };

/**
 * Client-side gate for portal pages. This is UX only — every API call is authorized
 * server-side, so bypassing this component exposes no data.
 */
export function RoleGate({ portal, children, fallback }: { portal: Portal; children: ReactNode; fallback?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isPending, isError, refetch } = useMe();
  const logout = useLogout();
  const m = useMessages();
  const t = m.auth.gate;

  useEffect(() => {
    if (user === null) router.replace(`${PORTAL_LOGIN[portal]}?next=${encodeURIComponent(pathname)}`);
  }, [user, portal, pathname, router]);

  if (isError) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyTitle>{t.loadError}</EmptyTitle>
          <EmptyDescription>{t.loadErrorBody}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => refetch()}>{m.common.actions.tryAgain}</Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (isPending || !user) return fallback ?? <GateSkeleton />;

  if (!hasRole(user, ROLE_FOR_PORTAL[portal])) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-warning/12 text-warning">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>{t.noAccess}</EmptyTitle>
          <EmptyDescription>{t.signedInAs(user.email)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button variant="outline" asChild>
            <Link href="/">{m.common.dashboard.backToStore}</Link>
          </Button>
          {portal === "affiliate" && (
            <Button variant="outline" asChild>
              <Link href="/affiliate/apply">{t.apply}</Link>
            </Button>
          )}
          <Button
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => router.replace(`${PORTAL_LOGIN[portal]}?next=${encodeURIComponent(pathname)}`) })
            }
          >
            {t.switchAccount}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <>{children}</>;
}

function GateSkeleton() {
  const t = useMessages().auth.gate;
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label={t.loading}>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
