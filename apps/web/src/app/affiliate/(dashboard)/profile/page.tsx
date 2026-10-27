"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Copy, FileText, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { AffiliateStatus } from "@ebook/shared";
import { IconChip, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PayoutDetailsCard } from "@/components/dashboard/payout-details-card";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { affiliateProfileKey, useAffiliateProfile, type AffiliateProfileDto } from "@/lib/affiliate";

const STATUS_TONE: Record<AffiliateStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "muted",
  suspended: "destructive",
};

export default function AffiliateProfilePage() {
  const t = useMessages().affiliate.profile;
  const { data: profile, isPending } = useAffiliateProfile();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      {isPending ? (
        <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !profile ? (
        <Empty className="bg-card rounded-2xl border border-solid">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>{t.notApplied}</EmptyTitle>
            <EmptyDescription>{t.notAppliedBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/affiliate/apply">
                {t.applyNow} <ArrowRight />
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
          <PayoutDetailsCard payout={profile.payout} endpoint="/affiliate/me/payout" onSaved={(p: AffiliateProfileDto) => qc.setQueryData(affiliateProfileKey, p)} />
          <ApplicationCard profile={profile} />
        </div>
      )}
    </>
  );
}

function ApplicationCard({ profile }: { profile: AffiliateProfileDto }) {
  const messages = useMessages();
  const a = messages.affiliate;
  const t = a.profile;
  const fmt = useAffiliateFormat();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.code);
      toast.success(t.codeCopied);
    } catch {
      toast.error(a.common.copyFailed);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <IconChip icon={FileText} tone="violet" />
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t.applicationTitle}
              <StatusPill tone={STATUS_TONE[profile.status]}>{a.accountStatus[profile.status]}</StatusPill>
            </CardTitle>
            <CardDescription>{t.appliedOn(fmt.date(profile.application.submittedAt ?? profile.createdAt))}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{t.code}</p>
            <p className="truncate font-mono text-lg font-semibold tracking-wide">{profile.code}</p>
          </div>
          <Button variant="outline" size="icon-lg" className="bg-background" onClick={copyCode} aria-label={t.copyCode}>
            <Copy />
          </Button>
        </div>
        <dl className="space-y-4 text-sm">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.website}</dt>
            <dd className="break-all">{profile.application.website || "—"}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-muted-foreground text-xs font-medium">{t.channels}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {profile.application.channels.length
                ? profile.application.channels.map((c) => (
                    <Badge key={c} variant="secondary">
                      {a.channels[c] ?? c}
                    </Badge>
                  ))
                : "—"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.audience}</dt>
            <dd>{a.audience[profile.application.audienceSize] ?? profile.application.audienceSize}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">{t.plan}</dt>
            <dd className="bg-muted/40 rounded-lg p-3 whitespace-pre-line">{profile.application.promotionPlan}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
