"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, Info, PenLine, Percent, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_AUTHOR_SHARE_PERCENT, formatINR, type AdminAuthor, type AuthorStatus } from "@ebook/shared";
import { FilterPills, ListCard, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

const authorsKey = ["admin", "authors"] as const;

const STATUS_TONE: Record<AuthorStatus, PillTone> = { pending: "warning", approved: "success", rejected: "muted", suspended: "destructive" };

const FILTERS: { value: AuthorStatus | "all"; label: string }[] = [
  { value: "pending", label: "Applications" },
  { value: "approved", label: "Approved" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

interface Destination {
  method: "upi" | "bank_transfer" | null;
  upiId: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
}

type Dialogs =
  | { kind: "approve" | "share"; author: AdminAuthor }
  | { kind: "reject" | "suspend"; author: AdminAuthor }
  | { kind: "pay"; author: AdminAuthor }
  | { kind: "view"; author: AdminAuthor };

export default function AdminAuthorsPage() {
  const [status, setStatus] = useState<AuthorStatus | "all">("pending");
  const [open, setOpen] = useState<Dialogs | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...authorsKey, status],
    queryFn: () => api<{ items: AdminAuthor[] }>(`/admin/authors${status !== "all" ? `?status=${status}` : ""}`).then((r) => r.items),
  });

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Authors"
        description="Writers who publish their own eBooks. Approve applications, set each author's share and record their payments."
      />

      <div className="bg-primary/5 border-primary/20 mb-6 flex gap-3 rounded-2xl border p-4 text-sm">
        <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">How authors are paid:</span> on each of their books sold, any affiliate commission comes off first, then
          the author gets their share of the rest. Earnings are held for the refund window, then become payable. Pay authors from your bank or UPI and record the
          reference here. Their books arrive under eBooks → In review.
        </p>
      </div>

      <ListCard
        toolbar={
          <>
            <FilterPills label="Filter by status" value={status} onChange={setStatus} options={FILTERS} />
            {data ? <p className="text-muted-foreground shrink-0 text-sm">{data.length} authors</p> : null}
          </>
        }
      >
        {isError ? (
          <ListError title="Couldn't load authors" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={4} />
        ) : data.length === 0 ? (
          <ListEmpty icon={PenLine} title="No authors here" description="Writers apply from the “Publish your eBook” link in the site footer (/author/apply)." />
        ) : (
          <Table className="min-w-220">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>eBooks</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4">
                    <button type="button" className="text-left hover:underline" onClick={() => setOpen({ kind: "view", author: a })}>
                      <span className="font-medium">{a.penName}</span>
                    </button>
                    <div className="text-muted-foreground text-xs">
                      {a.user.name} · {a.user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={STATUS_TONE[a.status]} className="capitalize">
                      {a.status}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="tabular-nums">{a.sharePercent}%</TableCell>
                  <TableCell className="tabular-nums">{a.books}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-semibold">{formatINR(a.payablePaise)}</span>
                    {a.paidPaise ? <div className="text-muted-foreground text-xs">{formatINR(a.paidPaise)} paid</div> : null}
                  </TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => setOpen({ kind: "approve", author: a })}>
                          <Check /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen({ kind: "reject", author: a })}>
                          <X /> Reject
                        </Button>
                      </>
                    )}
                    {a.status === "suspended" && (
                      <Button size="sm" variant="outline" onClick={() => setOpen({ kind: "approve", author: a })}>
                        Re-activate
                      </Button>
                    )}
                    {a.status === "approved" && (
                      <>
                        <Button size="sm" disabled={a.payablePaise <= 0} onClick={() => setOpen({ kind: "pay", author: a })}>
                          <Banknote /> Record payment
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Change ${a.penName}'s share`} onClick={() => setOpen({ kind: "share", author: a })}>
                          <Percent />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen({ kind: "suspend", author: a })}>
                          Suspend
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListCard>

      {open?.kind === "approve" || open?.kind === "share" ? (
        <ShareDialog key={`${open.kind}-${open.author.id}`} author={open.author} mode={open.kind} onClose={() => setOpen(null)} />
      ) : null}
      {open?.kind === "reject" || open?.kind === "suspend" ? (
        <NoteDialog key={`${open.kind}-${open.author.id}`} author={open.author} mode={open.kind} onClose={() => setOpen(null)} />
      ) : null}
      {open?.kind === "pay" ? <PayDialog key={open.author.id} author={open.author} onClose={() => setOpen(null)} /> : null}
      {open?.kind === "view" ? <ViewDialog author={open.author} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function useAuthorMutation(onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body: unknown; method?: "POST" | "PUT" }) => api(path, { method, body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authorsKey });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function ShareDialog({ author, mode, onClose }: { author: AdminAuthor; mode: "approve" | "share"; onClose: () => void }) {
  const [share, setShare] = useState(String(mode === "approve" && author.status === "pending" ? DEFAULT_AUTHOR_SHARE_PERCENT : author.sharePercent));
  const save = useAuthorMutation(() => {
    toast.success(mode === "approve" ? `${author.penName} can now add eBooks` : "Share updated for future sales");
    onClose();
  });
  const value = Math.round(Number(share));
  const valid = Number.isFinite(value) && value >= 1 && value <= 95;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "approve" ? `Approve ${author.penName}` : `Change ${author.penName}'s share`}</DialogTitle>
          <DialogDescription>
            The author&apos;s share of each of their books sold, after any affiliate commission. Orders already placed keep the share they were made with.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="share">Author share (%)</FieldLabel>
          <Input id="share" type="number" inputMode="numeric" min={1} max={95} value={share} onChange={(e) => setShare(e.target.value)} />
          <FieldDescription>
            {valid ? `Example: a ₹200 sale with a 20% affiliate commission pays the author ${formatINR(Math.floor((16_000 * value) / 100))}.` : "Between 1% and 95%."}
          </FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                mode === "approve"
                  ? { path: `/admin/authors/${author.id}/approve`, body: { sharePercent: value } }
                  : { path: `/admin/authors/${author.id}/share`, body: { sharePercent: value }, method: "PUT" },
              )
            }
          >
            {save.isPending ? <Spinner /> : null} {mode === "approve" ? "Approve" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ author, mode, onClose }: { author: AdminAuthor; mode: "reject" | "suspend"; onClose: () => void }) {
  const [note, setNote] = useState("");
  const save = useAuthorMutation(() => {
    toast.success(mode === "reject" ? "Application rejected" : "Author suspended");
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "reject" ? `Reject ${author.penName}'s application?` : `Suspend ${author.penName}?`}</DialogTitle>
          <DialogDescription>
            {mode === "reject"
              ? "They can update their application and apply again."
              : "They can no longer add or change books. Their live books stay in the store until you unpublish them, and earnings already made are still owed."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="note">Reason (shown to the author)</FieldLabel>
          <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={note.trim().length < 3 || save.isPending} onClick={() => save.mutate({ path: `/admin/authors/${author.id}/${mode}`, body: { note } })}>
            {save.isPending ? <Spinner /> : null} {mode === "reject" ? "Reject" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ author, onClose }: { author: AdminAuthor; onClose: () => void }) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const destination = useQuery({
    queryKey: ["admin", "author-destination", author.id],
    queryFn: () => api<Destination>(`/admin/authors/${author.id}/destination`),
    staleTime: 0,
    gcTime: 0,
  });
  const save = useAuthorMutation(() => {
    toast.success("Payment recorded");
    onClose();
  });
  const d = destination.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {author.penName} {formatINR(author.payablePaise)}</DialogTitle>
          <DialogDescription>First send the money from your bank or UPI app. Then enter the transaction reference it gave you.</DialogDescription>
        </DialogHeader>
        <div className="bg-muted/60 rounded-xl border p-4 text-sm">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Pay to</p>
          {destination.isPending ? (
            <Skeleton className="h-12" />
          ) : d?.method === "upi" ? (
            <p>
              UPI: <span className="font-mono font-medium">{d.upiId}</span>
            </p>
          ) : d?.method === "bank_transfer" ? (
            <dl className="grid grid-cols-[90px_1fr] gap-1.5">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{d.accountName}</dd>
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-mono">{d.accountNumber}</dd>
              <dt className="text-muted-foreground">IFSC</dt>
              <dd className="font-mono">{d.ifsc}</dd>
            </dl>
          ) : (
            <p className="text-warning">This author has not added payout details yet.</p>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor="ref">Transaction reference (UTR / UPI ref)</FieldLabel>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" className="font-mono" />
        </Field>
        <Field>
          <FieldLabel htmlFor="pay-note">Internal note (optional)</FieldLabel>
          <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={reference.trim().length < 4 || save.isPending} onClick={() => save.mutate({ path: `/admin/authors/${author.id}/payouts`, body: { reference, note } })}>
            {save.isPending ? <Spinner /> : null} Mark as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ author, onClose }: { author: AdminAuthor; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{author.penName}</DialogTitle>
          <DialogDescription>
            {author.user.name} · {author.user.email}
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-4 text-sm">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">What they write</dt>
            <dd className="bg-muted/40 rounded-lg p-3 whitespace-pre-line">{author.aboutBooks || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Bio</dt>
            <dd className="whitespace-pre-line">{author.bio || "—"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs font-medium">Website</dt>
            <dd className="break-all">
              {author.website ? (
                <a href={author.website} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                  {author.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {author.reviewNote ? (
            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs font-medium">Review note</dt>
              <dd>{author.reviewNote}</dd>
            </div>
          ) : null}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
