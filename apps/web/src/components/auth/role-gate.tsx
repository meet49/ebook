"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { Portal, Role } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    if (user === null) router.replace(`${PORTAL_LOGIN[portal]}?next=${encodeURIComponent(pathname)}`);
  }, [user, portal, pathname, router]);

  if (isError) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyTitle>We couldn&apos;t load your account</EmptyTitle>
          <EmptyDescription>Please check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => refetch()}>Try again</Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (isPending || !user) return fallback ?? <GateSkeleton />;

  if (!hasRole(user, ROLE_FOR_PORTAL[portal])) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>This area isn&apos;t available to your account</EmptyTitle>
          <EmptyDescription>
            You are signed in as {user.email}. Sign in with an account that has access, or go back to the store.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-center">
          <Button variant="outline" asChild>
            <Link href="/">Back to store</Link>
          </Button>
          {portal === "affiliate" && (
            <Button variant="outline" asChild>
              <Link href="/affiliate/apply">Apply to become an affiliate</Link>
            </Button>
          )}
          <Button
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => router.replace(`${PORTAL_LOGIN[portal]}?next=${encodeURIComponent(pathname)}`) })
            }
          >
            Switch account
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return <>{children}</>;
}

function GateSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading">
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
