"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Megaphone, ShieldOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { useAffiliateProfile, type AffiliateProfileDto } from "@/lib/affiliate";
import { cn } from "@/lib/utils";

function GateState({
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  tone: "primary" | "warning" | "destructive";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Empty className="bg-card relative min-h-[50vh] overflow-hidden rounded-2xl border border-solid">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <EmptyHeader className="relative">
        <EmptyMedia
          className={cn(
            "size-14 rounded-2xl",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "warning" && "bg-warning/12 text-warning",
            tone === "destructive" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-semibold">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent className="relative">{children}</EmptyContent> : null}
    </Empty>
  );
}

/** Shows the right state for applicants; renders children only for approved affiliates. */
export function AffiliateGate({ children }: { children: (profile: AffiliateProfileDto) => ReactNode }) {
  const t = useMessages();
  const g = t.affiliate.gate;
  const { data: profile, isPending, isError, refetch } = useAffiliateProfile();

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <GateState icon={AlertTriangle} tone="destructive" title={g.loadError}>
        <Button variant="outline" onClick={() => refetch()}>
          {t.common.actions.tryAgain}
        </Button>
      </GateState>
    );
  }
  if (!profile || profile.status === "rejected") {
    return (
      <GateState icon={Megaphone} tone="primary" title={profile ? g.rejectedTitle : g.joinTitle} description={profile?.reviewNote ?? g.joinBody}>
        <Button asChild size="lg">
          <Link href="/affiliate/apply">
            {profile ? g.applyAgain : g.applyNow} <ArrowRight />
          </Link>
        </Button>
      </GateState>
    );
  }
  if (profile.status === "pending") {
    return (
      <GateState icon={Clock} tone="warning" title={g.pendingTitle} description={g.pendingBody}>
        <Button asChild variant="outline">
          <Link href="/affiliate/profile">{g.addPayout}</Link>
        </Button>
      </GateState>
    );
  }
  if (profile.status === "suspended") {
    return (
      <GateState icon={ShieldOff} tone="destructive" title={g.suspendedTitle} description={`${profile.reviewNote ?? g.suspendedFallback} ${g.suspendedKept}`}>
        <Button asChild variant="outline">
          <Link href="/affiliate/payouts">{g.viewPayouts}</Link>
        </Button>
      </GateState>
    );
  }
  return <>{children(profile)}</>;
}
