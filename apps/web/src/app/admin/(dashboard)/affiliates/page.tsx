"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { formatINR, type AffiliateStatus, type Paginated } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AffiliateProfileDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";

interface AdminAffiliate extends AffiliateProfileDto {
  user: { name: string; email: string };
  stats: { clicks: number; sales: number; earnedPaise: number };
}

type Decision = "approve" | "reject" | "suspend" | "reinstate";

const DECISION_TEXT: Record<Decision, { title: string; body: string; label: string; destructive?: boolean; noteRequired?: boolean }> = {
  approve: { title: "Approve affiliate", body: "They will be able to create referral links and earn commission. We'll email them.", label: "Approve" },
  reject: { title: "Reject application", body: "We'll email them. They can re-apply later.", label: "Reject", destructive: true },
  suspend: { title: "Suspend affiliate", body: "Their links stop earning immediately. Existing commissions are kept for review.", label: "Suspend", destructive: true, noteRequired: true },
  reinstate: { title: "Reinstate affiliate", body: "Their links start earning again.", label: "Reinstate" },
};

const DONE: Record<Decision, string> = { approve: "Affiliate approved", reject: "Application rejected", suspend: "Affiliate suspended", reinstate: "Affiliate reinstated" };

const STATUS_STYLE: Record<AffiliateStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/20",
  approved: "bg-success/15 text-success border-success/20",
  rejected: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function AdminAffiliatesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AffiliateStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ affiliate: AdminAffiliate; decision: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["admin", "affiliates", status, page],
    queryFn: () => api<Paginated<AdminAffiliate>>(`/admin/affiliates?page=${page}${status !== "all" ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const decide = useMutation({
    mutationFn: () => api(`/admin/affiliates/${action!.affiliate.id}/${action!.decision}`, { method: "POST", body: { note } }),
    onSuccess: async () => {
      toast.success(DONE[action!.decision]);
      setAction(null);
      setNote("");
      await qc.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const text = action ? DECISION_TEXT[action.decision] : null;

  return (
    <>
      <PageHeader title="Affiliates" description="Review applications and manage affiliate partners." />
      <Tabs value={status} onValueChange={(v) => { setStatus(v as AffiliateStatus | "all"); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden py-0">
        {isPending ? (
          <Skeleton className="m-4 h-40" />
        ) : !data?.items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>{status === "pending" ? "No applications waiting" : "No affiliates here"}</EmptyTitle>
              <EmptyDescription>Applications from /affiliate/apply appear in Pending.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Affiliate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <Fragment key={a.id}>
                  <TableRow>
                    <TableCell className="pl-4">
                      <button type="button" className="text-left hover:underline" onClick={() => setExpanded(expanded === a.id ? null : a.id)} aria-expanded={expanded === a.id}>
                        <span className="font-medium">{a.user.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {a.user.email} · {a.code}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${STATUS_STYLE[a.status]}`}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{a.application.channels.join(", ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.stats.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.stats.sales}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(a.stats.earnedPaise)}</TableCell>
                    <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                      {a.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => setAction({ affiliate: a, decision: "approve" })}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "reject" })}>Reject</Button>
                        </>
                      )}
                      {a.status === "approved" && <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "suspend" })}>Suspend</Button>}
                      {a.status === "suspended" && <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "reinstate" })}>Reinstate</Button>}
                      {a.status === "rejected" && <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "approve" })}>Approve</Button>}
                    </TableCell>
                  </TableRow>
                  {expanded === a.id && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="px-4 py-3 text-sm whitespace-normal">
                        <dl className="grid gap-2 sm:grid-cols-[140px_1fr]">
                          <dt className="text-muted-foreground">Website</dt>
                          <dd>{a.application.website ? <a href={a.application.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">{a.application.website}</a> : "—"}</dd>
                          <dt className="text-muted-foreground">Audience</dt>
                          <dd>{a.application.audienceSize}</dd>
                          <dt className="text-muted-foreground">Promotion plan</dt>
                          <dd className="whitespace-pre-line">{a.application.promotionPlan}</dd>
                          <dt className="text-muted-foreground">Payout method</dt>
                          <dd>{a.payout ? (a.payout.method === "upi" ? `UPI ${a.payout.upiId}` : `Bank ••••${a.payout.accountNumberLast4}`) : "Not set"}</dd>
                          {a.reviewNote ? (<><dt className="text-muted-foreground">Review note</dt><dd>{a.reviewNote}</dd></>) : null}
                        </dl>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
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

      <Dialog open={action !== null} onOpenChange={(open) => { if (!open) { setAction(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text?.title}: {action?.affiliate.user.name}</DialogTitle>
            <DialogDescription>{text?.body}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="decision-note">Note {text?.noteRequired ? "(required)" : "(optional, shared with the affiliate)"}</FieldLabel>
            <Textarea id="decision-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant={text?.destructive ? "destructive" : "default"} disabled={decide.isPending || (text?.noteRequired && note.trim().length < 3)} onClick={() => decide.mutate()}>
              {decide.isPending ? <Spinner /> : null}
              {text?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
