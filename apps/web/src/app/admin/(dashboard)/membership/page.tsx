"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Info, Pencil, Plus, Rocket, Ticket, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, formatUSD, type AdminMembershipPlan, type MembershipPlanInput } from "@ebook/shared";
import { ListCard, StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, errorMessage } from "@/lib/api";
import { ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

const plansKey = ["admin", "membership", "plans"] as const;

const STATUS_TONE: Record<string, PillTone> = { published: "success", draft: "muted", unpublished: "warning", archived: "muted" };

/** Form values as typed; converted to paise / basis points on save. */
interface FormState {
  title: string;
  durationDays: string;
  price: string;
  salePrice: string;
  intlPrice: string;
  description: string;
  benefitsText: string;
  featured: boolean;
  affiliateEnabled: boolean;
  commissionType: "percent" | "fixed";
  commissionValue: string;
}

const EMPTY: FormState = {
  title: "",
  durationDays: "30",
  price: "",
  salePrice: "",
  intlPrice: "",
  description: "",
  benefitsText: "Read every included eBook\nNew eBooks added during your pass are included\nRead on phone, tablet and laptop",
  featured: false,
  affiliateEnabled: true,
  commissionType: "percent",
  commissionValue: "20",
};

const toMinor = (v: string) => Math.round(Number(v) * 100);
const fromMinor = (v: number) => String(v / 100);

function formOf(p: AdminMembershipPlan): FormState {
  return {
    title: p.title,
    durationDays: String(p.durationDays),
    price: fromMinor(p.pricePaise),
    salePrice: p.salePricePaise != null ? fromMinor(p.salePricePaise) : "",
    intlPrice: p.intlPriceCents != null ? fromMinor(p.intlPriceCents) : "",
    description: p.description,
    benefitsText: p.benefits.join("\n"),
    featured: p.featured,
    affiliateEnabled: p.affiliate.enabled,
    commissionType: p.affiliate.type,
    commissionValue: fromMinor(p.affiliate.value),
  };
}

function inputOf(f: FormState): MembershipPlanInput {
  return {
    title: f.title,
    durationDays: Math.round(Number(f.durationDays)),
    pricePaise: toMinor(f.price),
    salePricePaise: f.salePrice.trim() ? toMinor(f.salePrice) : null,
    intlPriceCents: f.intlPrice.trim() ? toMinor(f.intlPrice) : null,
    description: f.description,
    benefits: f.benefitsText.split("\n").map((s) => s.trim()).filter(Boolean),
    featured: f.featured,
    // Percent is stored in basis points (2000 = 20%), fixed in paise: both are value × 100.
    affiliate: { enabled: f.affiliateEnabled, type: f.commissionType, value: toMinor(f.commissionValue || "0") },
  };
}

export default function AdminMembershipPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminMembershipPlan | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminMembershipPlan | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: plansKey,
    queryFn: () => api<{ items: AdminMembershipPlan[]; members: number }>("/admin/membership/plans"),
  });

  const setStatus = useMutation({
    mutationFn: ({ plan, publish }: { plan: AdminMembershipPlan; publish: boolean }) =>
      api(`/admin/membership/plans/${plan.id}/${publish ? "publish" : "unpublish"}`, { method: "POST" }),
    onSuccess: (_d, { plan, publish }) => {
      toast.success(publish ? `“${plan.title}” is on sale` : `“${plan.title}” is hidden`);
      return qc.invalidateQueries({ queryKey: plansKey });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (plan: AdminMembershipPlan) => api<{ archived: boolean }>(`/admin/membership/plans/${plan.id}`, { method: "DELETE" }),
    onSuccess: async (res) => {
      toast.success(res.archived ? "Plan archived (it has orders, so it is kept for history)" : "Plan deleted");
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: plansKey });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        eyebrow="Store"
        title="Membership"
        description="ReadnShare Pass plans. A pass opens every published eBook marked “Included in ReadnShare Pass” for the plan's days."
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <Plus /> New plan
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="bg-card flex items-center gap-4 rounded-2xl border p-5">
          <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
            <Users className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-muted-foreground text-sm">Active members</p>
            <p className="text-2xl font-semibold tabular-nums">{data ? data.members : "—"}</p>
          </div>
        </div>
        <div className="bg-primary/5 border-primary/20 flex gap-3 rounded-2xl border p-5 text-sm">
          <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-muted-foreground">
            Passes are one-time payments and never renew. Buying again adds the days after the current pass. A full refund ends the pass. To keep a book out of the pass,
            turn off “Included in ReadnShare Pass” on the book.
          </p>
        </div>
      </div>

      <ListCard>
        {isError ? (
          <ListError title="Couldn't load plans" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={3} />
        ) : data.items.length === 0 ? (
          <ListEmpty icon={Ticket} title="No plans yet" description="Create plans like Monthly (30 days) and Yearly (365 days), then publish them.">
            <Button onClick={() => setEditing("new")}>
              <Plus /> New plan
            </Button>
          </ListEmpty>
        ) : (
          <Table className="min-w-180">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{p.title}</span>
                    {p.featured ? <span className="text-primary ml-2 text-xs font-semibold">Best value</span> : null}
                    <div className="text-muted-foreground text-xs">{p.durationDays} days</div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span className="font-medium">{formatINR(p.effectivePricePaise)}</span>
                    {p.salePricePaise != null && <span className="text-muted-foreground ml-1 text-xs line-through">{formatINR(p.pricePaise)}</span>}
                    {p.intlPriceCents != null && <span className="text-muted-foreground block text-xs">Intl {formatUSD(p.intlPriceCents)}</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.sold}</TableCell>
                  <TableCell>
                    <StatusPill tone={STATUS_TONE[p.status] ?? "muted"} className="capitalize">
                      {p.status}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                    {p.status === "published" ? (
                      <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ plan: p, publish: false })}>
                        <EyeOff /> Unpublish
                      </Button>
                    ) : (
                      <Button size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ plan: p, publish: true })}>
                        <Rocket /> Publish
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${p.title}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListCard>

      {editing !== null && <PlanDialog key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.sold
                ? "This plan has been sold, so it will be archived instead: it leaves the store, and existing passes keep running."
                : "The plan will be removed. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting);
              }}
            >
              {remove.isPending ? <Spinner /> : null} {deleting?.sold ? "Archive" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlanDialog({ plan, onClose }: { plan: AdminMembershipPlan | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (plan ? formOf(plan) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      plan
        ? api(`/admin/membership/plans/${plan.id}`, { method: "PUT", body: inputOf(form) })
        : api("/admin/membership/plans", { method: "POST", body: inputOf(form) }),
    onSuccess: async () => {
      toast.success(plan ? "Plan saved" : "Plan created as a draft. Publish it to put it on sale.");
      await qc.invalidateQueries({ queryKey: plansKey });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.details) setErrors(e.details);
      toast.error(errorMessage(e));
    },
  });

  const err = (key: string) => (errors[key]?.length ? <FieldError>{errors[key]![0]}</FieldError> : null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.title}` : "New plan"}</DialogTitle>
          <DialogDescription>Changes apply to new purchases. Passes already sold keep the days they were bought with.</DialogDescription>
        </DialogHeader>
        <form
          id="plan-form"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            save.mutate();
          }}
        >
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
              <Field data-invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="p-title">Name</FieldLabel>
                <Input id="p-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Monthly" required />
                {err("title")}
              </Field>
              <Field data-invalid={Boolean(errors.durationDays)}>
                <FieldLabel htmlFor="p-days">Days</FieldLabel>
                <Input id="p-days" type="number" inputMode="numeric" min={1} value={form.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
                {err("durationDays")}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={Boolean(errors.pricePaise)}>
                <FieldLabel htmlFor="p-price">Price (₹)</FieldLabel>
                <Input id="p-price" type="number" inputMode="decimal" min={1} step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} required />
                {err("pricePaise")}
              </Field>
              <Field data-invalid={Boolean(errors.salePricePaise)}>
                <FieldLabel htmlFor="p-sale">Sale price (₹)</FieldLabel>
                <Input id="p-sale" type="number" inputMode="decimal" min={1} step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="None" />
                {err("salePricePaise")}
              </Field>
              <Field data-invalid={Boolean(errors.intlPriceCents)}>
                <FieldLabel htmlFor="p-intl">Intl price ($)</FieldLabel>
                <Input id="p-intl" type="number" inputMode="decimal" min={1} step="0.01" value={form.intlPrice} onChange={(e) => set("intlPrice", e.target.value)} placeholder="None" />
                {err("intlPriceCents")}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="p-desc">Short description (optional)</FieldLabel>
              <Textarea id="p-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-benefits">Benefits</FieldLabel>
              <Textarea id="p-benefits" rows={4} value={form.benefitsText} onChange={(e) => set("benefitsText", e.target.value)} />
              <FieldDescription>One per line. Shown with a tick on the membership page.</FieldDescription>
            </Field>

            <div className="grid gap-5 sm:grid-cols-[auto_1fr_120px] sm:items-end">
              <Field orientation="horizontal" className="sm:pb-2">
                <Switch id="p-aff" checked={form.affiliateEnabled} onCheckedChange={(v) => set("affiliateEnabled", v)} />
                <FieldLabel htmlFor="p-aff">Affiliate commission</FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="p-ctype">Type</FieldLabel>
                <Select value={form.commissionType} onValueChange={(v) => set("commissionType", v as FormState["commissionType"])} disabled={!form.affiliateEnabled}>
                  <SelectTrigger id="p-ctype" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent of sale</SelectItem>
                    <SelectItem value="fixed">Fixed ₹ per sale</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(errors["affiliate.value"])}>
                <FieldLabel htmlFor="p-cval">{form.commissionType === "percent" ? "%" : "₹"}</FieldLabel>
                <Input
                  id="p-cval"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.commissionValue}
                  onChange={(e) => set("commissionValue", e.target.value)}
                  disabled={!form.affiliateEnabled}
                />
                {err("affiliate.value")}
              </Field>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <span>
                <span className="block text-sm font-medium">Best value</span>
                <span className="text-muted-foreground block text-xs">Highlight this plan on the membership page.</span>
              </span>
              <Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} />
            </label>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" disabled={save.isPending || !form.title.trim() || !form.price}>
            {save.isPending ? <Spinner /> : null} {plan ? "Save" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
