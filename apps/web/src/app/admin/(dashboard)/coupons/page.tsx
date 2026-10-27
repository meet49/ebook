"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR, type AdminCoupon, type AdminProduct, type CouponInput, type CouponScope, type Paginated } from "@ebook/shared";
import { ListCard, StatusPill } from "@/components/dashboard/list-ui";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, api, errorMessage } from "@/lib/api";
import { ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

const couponsKey = ["admin", "coupons"] as const;
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const SCOPES: { value: CouponScope; label: string }[] = [
  { value: "books", label: "All eBooks" },
  { value: "selected", label: "Selected eBooks" },
  { value: "membership", label: "Membership passes" },
  { value: "all", label: "Everything" },
];

/** The form keeps text as typed; it is converted to the API's numbers on save. */
interface FormState {
  code: string;
  description: string;
  type: "percent" | "fixed";
  percentOff: string;
  amountOffRupees: string;
  appliesTo: CouponScope;
  productIds: string[];
  minOrderRupees: string;
  maxRedemptions: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  affiliateCode: string;
}

const EMPTY: FormState = {
  code: "",
  description: "",
  type: "percent",
  percentOff: "10",
  amountOffRupees: "",
  appliesTo: "books",
  productIds: [],
  minOrderRupees: "",
  maxRedemptions: "",
  perUserLimit: "1",
  startsAt: "",
  endsAt: "",
  active: true,
  affiliateCode: "",
};

/** ISO → the value a datetime-local input expects, in the admin's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const intOrNull = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
const rupeesToPaise = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 100));

function formOf(c: AdminCoupon): FormState {
  return {
    code: c.code,
    description: c.description,
    type: c.type,
    percentOff: c.percentOff != null ? String(c.percentOff) : "",
    amountOffRupees: c.amountOffPaise != null ? String(c.amountOffPaise / 100) : "",
    appliesTo: c.appliesTo,
    productIds: c.productIds,
    minOrderRupees: c.minOrderPaise ? String(c.minOrderPaise / 100) : "",
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : "",
    perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : "",
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
    active: c.active,
    affiliateCode: c.affiliateCode ?? "",
  };
}

function inputOf(f: FormState): CouponInput {
  return {
    code: f.code,
    description: f.description,
    type: f.type,
    percentOff: f.type === "percent" ? intOrNull(f.percentOff) : null,
    amountOffPaise: f.type === "fixed" ? rupeesToPaise(f.amountOffRupees) : null,
    appliesTo: f.appliesTo,
    productIds: f.appliesTo === "selected" ? f.productIds : [],
    minOrderPaise: rupeesToPaise(f.minOrderRupees) ?? 0,
    maxRedemptions: intOrNull(f.maxRedemptions),
    perUserLimit: intOrNull(f.perUserLimit),
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    active: f.active,
    affiliateCode: f.affiliateCode,
  };
}

function discountLabel(c: AdminCoupon) {
  return c.type === "percent" ? `${c.percentOff}% off` : `${formatINR(c.amountOffPaise ?? 0)} off`;
}

function stateOf(c: AdminCoupon): { label: string; tone: "success" | "warning" | "muted" } {
  const now = Date.now();
  if (!c.active) return { label: "Off", tone: "muted" };
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { label: "Expired", tone: "muted" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", tone: "warning" };
  if (c.maxRedemptions != null && c.uses >= c.maxRedemptions) return { label: "Used up", tone: "muted" };
  return { label: "Live", tone: "success" };
}

export default function AdminCouponsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: couponsKey,
    queryFn: () => api<{ items: AdminCoupon[] }>("/admin/coupons").then((r) => r.items),
  });

  const toggle = useMutation({
    mutationFn: (c: AdminCoupon) => api(`/admin/coupons/${c.id}`, { method: "PUT", body: inputOf({ ...formOf(c), active: !c.active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: couponsKey }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (c: AdminCoupon) => api(`/admin/coupons/${c.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Coupon deleted");
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: couponsKey });
    },
    onError: (e) => {
      setDeleting(null);
      toast.error(errorMessage(e));
    },
  });

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ebooks?coupon=${encodeURIComponent(code)}`);
      toast.success("Store link with this coupon copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Store"
        title="Coupons"
        description="Discount codes for sales, festivals and partners. A coupon counts as used only when the order is paid."
        actions={
          <Button size="lg" onClick={() => setEditing("new")}>
            <Plus /> New coupon
          </Button>
        }
      />

      <ListCard>
        {isError ? (
          <ListError title="Couldn't load coupons" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={4} />
        ) : data.length === 0 ? (
          <ListEmpty icon={TicketPercent} title="No coupons yet" description="Create a code like DIWALI20 and share it on Instagram, WhatsApp or with an affiliate.">
            <Button onClick={() => setEditing("new")}>
              <Plus /> New coupon
            </Button>
          </ListEmpty>
        ) : (
          <Table className="min-w-220">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => {
                const state = stateOf(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <span className="font-mono font-semibold tracking-wide">{c.code}</span>
                      {c.description ? <div className="text-muted-foreground max-w-56 truncate text-xs">{c.description}</div> : null}
                      {c.affiliateCode ? (
                        <div className="text-primary text-xs">
                          Affiliate <span className="font-mono">{c.affiliateCode}</span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{discountLabel(c)}</span>
                      <div className="text-muted-foreground text-xs">
                        {SCOPES.find((s) => s.value === c.appliesTo)?.label}
                        {c.appliesTo === "selected" ? ` (${c.productIds.length})` : ""}
                        {c.minOrderPaise ? ` · min ${formatINR(c.minOrderPaise)}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.startsAt || c.endsAt ? (
                        <>
                          {c.startsAt ? dateFmt.format(new Date(c.startsAt)) : "Now"} – {c.endsAt ? dateFmt.format(new Date(c.endsAt)) : "no end"}
                        </>
                      ) : (
                        "Always"
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-medium">
                        {c.uses}
                        {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                      </span>
                      <div className="text-muted-foreground text-xs">
                        {c.discountPaise ? `${formatINR(c.discountPaise)} given` : c.perUserLimit != null ? `${c.perUserLimit} per buyer` : "no buyer limit"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.active}
                          disabled={toggle.isPending}
                          onCheckedChange={() => toggle.mutate(c)}
                          aria-label={c.active ? `Turn off ${c.code}` : `Turn on ${c.code}`}
                        />
                        <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      </div>
                    </TableCell>
                    <TableCell className="space-x-1 pr-4 text-right whitespace-nowrap">
                      <Button size="icon-sm" variant="ghost" aria-label={`Copy store link with ${c.code}`} onClick={() => copyLink(c.code)}>
                        <Copy />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${c.code}`}
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListCard>

      {editing !== null && <CouponDialog key={editing === "new" ? "new" : editing.id} coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.uses
                ? "This coupon has been used, so it is kept for order history. Turn it off instead to stop new uses."
                : "Buyers will no longer be able to use this code. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleting?.uses && (
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-white"
                disabled={remove.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleting) remove.mutate(deleting);
                }}
              >
                {remove.isPending ? <Spinner /> : null} Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CouponDialog({ coupon, onClose }: { coupon: AdminCoupon | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (coupon ? formOf(coupon) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const books = useQuery({
    queryKey: ["admin", "products", "for-coupons"],
    queryFn: () => api<Paginated<AdminProduct>>("/admin/products?pageSize=100").then((r) => r.items.filter((p) => p.status !== "archived")),
    enabled: form.appliesTo === "selected",
  });

  const save = useMutation({
    mutationFn: () =>
      coupon
        ? api(`/admin/coupons/${coupon.id}`, { method: "PUT", body: inputOf(form) })
        : api("/admin/coupons", { method: "POST", body: inputOf(form) }),
    onSuccess: async () => {
      toast.success(coupon ? "Coupon saved" : `Coupon ${form.code.toUpperCase()} created`);
      await qc.invalidateQueries({ queryKey: couponsKey });
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
          <DialogTitle>{coupon ? `Edit ${coupon.code}` : "New coupon"}</DialogTitle>
          <DialogDescription>Buyers enter the code at checkout, or open a link with it already filled in.</DialogDescription>
        </DialogHeader>
        <form
          id="coupon-form"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            save.mutate();
          }}
        >
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.code)}>
                <FieldLabel htmlFor="c-code">Code</FieldLabel>
                <Input
                  id="c-code"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="DIWALI20"
                  maxLength={20}
                  autoComplete="off"
                  className="font-mono uppercase"
                  required
                />
                {err("code")}
              </Field>
              <Field>
                <FieldLabel htmlFor="c-type">Discount type</FieldLabel>
                <Select value={form.type} onValueChange={(v) => set("type", v as FormState["type"])}>
                  <SelectTrigger id="c-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent off</SelectItem>
                    <SelectItem value="fixed">Fixed amount off</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {form.type === "percent" ? (
              <Field data-invalid={Boolean(errors.percentOff)}>
                <FieldLabel htmlFor="c-pct">Percent off</FieldLabel>
                <Input id="c-pct" type="number" inputMode="numeric" min={1} max={90} value={form.percentOff} onChange={(e) => set("percentOff", e.target.value)} />
                <FieldDescription>1–90%. Taken off each eligible book, after any combo price.</FieldDescription>
                {err("percentOff")}
              </Field>
            ) : (
              <Field data-invalid={Boolean(errors.amountOffPaise)}>
                <FieldLabel htmlFor="c-amt">Amount off (₹)</FieldLabel>
                <Input id="c-amt" type="number" inputMode="decimal" min={1} step="0.01" value={form.amountOffRupees} onChange={(e) => set("amountOffRupees", e.target.value)} />
                <FieldDescription>Taken off the order. A book never drops below ₹1.</FieldDescription>
                {err("amountOffPaise")}
              </Field>
            )}

            <Field data-invalid={Boolean(errors.productIds)}>
              <FieldLabel htmlFor="c-scope">Applies to</FieldLabel>
              <Select value={form.appliesTo} onValueChange={(v) => set("appliesTo", v as CouponScope)}>
                <SelectTrigger id="c-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.appliesTo === "selected" && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {books.isPending ? (
                    <Spinner />
                  ) : (
                    books.data?.map((p) => (
                      <label key={p.id} className="hover:bg-muted/60 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                        <Checkbox
                          checked={form.productIds.includes(p.id)}
                          onCheckedChange={(on) => set("productIds", on ? [...form.productIds, p.id] : form.productIds.filter((id) => id !== p.id))}
                        />
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">{formatINR(p.effectivePricePaise)}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
              {err("productIds")}
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="c-min">Min. order (₹)</FieldLabel>
                <Input id="c-min" type="number" inputMode="decimal" min={0} value={form.minOrderRupees} onChange={(e) => set("minOrderRupees", e.target.value)} placeholder="None" />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-max">Total uses</FieldLabel>
                <Input id="c-max" type="number" inputMode="numeric" min={1} value={form.maxRedemptions} onChange={(e) => set("maxRedemptions", e.target.value)} placeholder="Unlimited" />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-per">Per buyer</FieldLabel>
                <Input id="c-per" type="number" inputMode="numeric" min={1} value={form.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} placeholder="Unlimited" />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="c-start">Starts</FieldLabel>
                <Input id="c-start" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
                <FieldDescription>Empty: starts now.</FieldDescription>
              </Field>
              <Field data-invalid={Boolean(errors.endsAt)}>
                <FieldLabel htmlFor="c-end">Ends</FieldLabel>
                <Input id="c-end" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
                <FieldDescription>Empty: never ends.</FieldDescription>
                {err("endsAt")}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.affiliateCode)}>
              <FieldLabel htmlFor="c-aff">Affiliate code (optional)</FieldLabel>
              <Input
                id="c-aff"
                value={form.affiliateCode}
                onChange={(e) => set("affiliateCode", e.target.value.toUpperCase())}
                placeholder="e.g. RIYA2024"
                autoComplete="off"
                className="font-mono uppercase"
              />
              <FieldDescription>Sales with this coupon earn this affiliate their commission, even without their link.</FieldDescription>
              {err("affiliateCode")}
            </Field>

            <Field>
              <FieldLabel htmlFor="c-desc">Internal note (optional)</FieldLabel>
              <Input id="c-desc" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={200} placeholder="Diwali Instagram campaign" />
            </Field>

            <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <span>
                <span className="block text-sm font-medium">Active</span>
                <span className="text-muted-foreground block text-xs">Turn off to stop new uses without deleting.</span>
              </span>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </label>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" disabled={save.isPending || !form.code.trim()}>
            {save.isPending ? <Spinner /> : null} {coupon ? "Save" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
