"use client";

import Link from "next/link";
import { Clock, Megaphone, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateProfile, type AffiliateProfileDto } from "@/lib/affiliate";

/** Shows the right state for applicants; renders children only for approved affiliates. */
export function AffiliateGate({ children }: { children: (profile: AffiliateProfileDto) => ReactNode }) {
  const { data: profile, isPending, isError, refetch } = useAffiliateProfile();

  if (isPending) return <Skeleton className="h-64" />;
  if (isError) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Couldn&apos;t load your affiliate account</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (!profile || profile.status === "rejected") {
    return (
      <Empty className="min-h-[50vh] border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Megaphone />
          </EmptyMedia>
          <EmptyTitle>{profile ? "Your application was not approved" : "Join the affiliate program"}</EmptyTitle>
          <EmptyDescription>
            {profile?.reviewNote ?? "Apply to get referral links for every eBook and earn commission on verified sales."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/affiliate/apply">{profile ? "Apply again" : "Apply now"}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (profile.status === "pending") {
    return (
      <Empty className="min-h-[50vh] border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>Your application is under review</EmptyTitle>
          <EmptyDescription>
            We usually review applications within 2 business days and will email you as soon as you&apos;re approved. Meanwhile you can add your payout details.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/affiliate/profile">Add payout details</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (profile.status === "suspended") {
    return (
      <Empty className="min-h-[50vh] border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldOff />
          </EmptyMedia>
          <EmptyTitle>Your affiliate account is suspended</EmptyTitle>
          <EmptyDescription>{profile.reviewNote ?? "Please contact support for details."} Your earlier earnings and payouts remain visible.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/affiliate/payouts">View payouts</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return <>{children(profile)}</>;
}
