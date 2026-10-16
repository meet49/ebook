"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, UsersRound } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { formatINR, type AffiliateStatus, type Paginated } from "@ebook/shared";
import { FilterPills, ListCard, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AffiliateProfileDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListSkeleton } from "../_components/admin-list";

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

const STATUS_TONE: Record<AffiliateStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "muted",
  suspended: "destructive",
};

const FILTERS: { value: AffiliateStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

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
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader eyebrow="Partners" title="Affiliates" description="Review applications and manage affiliate partners. Select a name to see the full application." />

      <ListCard
        toolbar={
          <>
            <FilterPills
              label="Filter by status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={FILTERS}
            />
            {data ? <p className="text-muted-foreground shrink-0 text-sm">{data.total} affiliates</p> : null}
          </>
        }
      >
        {isPending ? (
          <ListSkeleton rows={4} />
        ) : !data?.items.length ? (
          <ListEmpty
            icon={UsersRound}
            title={status === "pending" ? "No applications waiting" : "No affiliates here"}
            description="Applications from /affiliate/apply appear in Pending."
          />
        ) : (
          <Table className={cn("min-w-200 transition-opacity", isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
              {data.items.map((a) => {
                const open = expanded === a.id;
                return (
                  <Fragment key={a.id}>
                    <TableRow className={cn(open && "bg-muted/40 border-b-0")}>
                      <TableCell className="pl-4">
                        <button
                          type="button"
                          className="focus-visible:ring-ring/50 group flex items-start gap-2 rounded text-left outline-none focus-visible:ring-3"
                          onClick={() => setExpanded(open ? null : a.id)}
                          aria-expanded={open}
                        >
                          <ChevronDown className={cn("text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
                          <span>
                            <span className="font-medium group-hover:underline">{a.user.name}</span>
                            <span className="text-muted-foreground block text-xs">
                              {a.user.email} · <span className="font-mono">{a.code}</span>
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={STATUS_TONE[a.status]} className="capitalize">
                          {a.status}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {a.application.channels.slice(0, 3).map((c) => (
                            <Badge key={c} variant="secondary" className="font-normal">
                              {c}
                            </Badge>
                          ))}
                          {a.application.channels.length > 3 ? (
                            <Badge variant="outline" className="font-normal">
                              +{a.application.channels.length - 3}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.stats.clicks}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.stats.sales}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatINR(a.stats.earnedPaise)}</TableCell>
                      <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                        {a.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => setAction({ affiliate: a, decision: "approve" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "reject" })}>
                              Reject
                            </Button>
                          </>
                        )}
                        {a.status === "approved" && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setAction({ affiliate: a, decision: "suspend" })}>
                            Suspend
                          </Button>
                        )}
                        {a.status === "suspended" && (
                          <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "reinstate" })}>
                            Reinstate
                          </Button>
                        )}
                        {a.status === "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => setAction({ affiliate: a, decision: "approve" })}>
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="px-4 pt-0 pb-4 text-sm whitespace-normal">
                          <dl className="bg-card grid gap-x-4 gap-y-2.5 rounded-xl border p-4 sm:grid-cols-[140px_1fr]">
                            <dt className="text-muted-foreground">Website</dt>
                            <dd className="break-all">
                              {a.application.website ? (
                                <a href={a.application.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                                  {a.application.website}
                                </a>
                              ) : (
                                "—"
                              )}
                            </dd>
                            <dt className="text-muted-foreground">Channels</dt>
                            <dd>{a.application.channels.join(", ") || "—"}</dd>
                            <dt className="text-muted-foreground">Audience</dt>
                            <dd>{a.application.audienceSize}</dd>
                            <dt className="text-muted-foreground">Promotion plan</dt>
                            <dd className="whitespace-pre-line">{a.application.promotionPlan}</dd>
                            <dt className="text-muted-foreground">Payout method</dt>
                            <dd>{a.payout ? (a.payout.method === "upi" ? `UPI ${a.payout.upiId}` : `Bank ••••${a.payout.accountNumberLast4}`) : "Not set"}</dd>
                            {a.reviewNote ? (
                              <>
                                <dt className="text-muted-foreground">Review note</dt>
                                <dd>{a.reviewNote}</dd>
                              </>
                            ) : null}
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} /> : null}
      </ListCard>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text?.title}: {action?.affiliate.user.name}
            </DialogTitle>
            <DialogDescription>{text?.body}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="decision-note">Note {text?.noteRequired ? "(required)" : "(optional, shared with the affiliate)"}</FieldLabel>
            <Textarea id="decision-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              variant={text?.destructive ? "destructive" : "default"}
              disabled={decide.isPending || (text?.noteRequired && note.trim().length < 3)}
              onClick={() => decide.mutate()}
            >
              {decide.isPending ? <Spinner /> : null}
              {text?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
