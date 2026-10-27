"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, PenLine, ShieldOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AuthorProfileDto } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { useAuthorProfile } from "@/lib/author";
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

/** Shows the right state for applicants; renders children only for approved authors. */
export function AuthorGate({ children }: { children: (profile: AuthorProfileDto) => ReactNode }) {
  const m = useMessages();
  const g = m.author.gate;
  const { data: profile, isPending, isError, refetch } = useAuthorProfile();

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError) {
    return (
      <GateState icon={AlertTriangle} tone="destructive" title={g.loadError}>
        <Button variant="outline" onClick={() => refetch()}>
          {m.common.actions.tryAgain}
        </Button>
      </GateState>
    );
  }
  if (!profile || profile.status === "rejected") {
    return (
      <GateState icon={PenLine} tone="primary" title={profile ? g.rejectedTitle : g.joinTitle} description={profile?.reviewNote ?? g.joinBody}>
        <Button asChild size="lg">
          <Link href="/author/apply">
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
          <Link href="/author/profile">{g.addPayout}</Link>
        </Button>
      </GateState>
    );
  }
  if (profile.status === "suspended") {
    return <GateState icon={ShieldOff} tone="destructive" title={g.suspendedTitle} description={profile.reviewNote ?? g.suspendedFallback} />;
  }
  return <>{children(profile)}</>;
}
