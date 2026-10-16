"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, CreditCard, ExternalLink, Info, KeyRound, PlugZap, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IconChip, StatusPill } from "@/components/dashboard/list-ui";
import { PasswordInput } from "@/components/forms/password-input";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, api, errorMessage } from "@/lib/api";

interface PaymentSettings {
  mode: "test" | "live" | "unconfigured";
  source: "database" | "environment" | "none";
  keyId: string | null;
  keySecretLast4: string | null;
  webhookSecretSet: boolean;
  webhookUrl: string;
  webhookEvents: string[];
  environmentConfigured: boolean;
  savedInDashboard: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

const key = ["admin", "settings", "payments"] as const;

export default function SettingsPage() {
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<{ payments: PaymentSettings }>("/admin/settings/payments").then((r) => r.payments),
  });

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Store configuration. Changes take effect immediately — no restart needed." />
      <div className="max-w-3xl space-y-6">{isPending || !data ? <Skeleton className="h-96 rounded-2xl" /> : <PaymentsCard settings={data} />}</div>
    </>
  );
}

function StatusBadge({ s }: { s: PaymentSettings }) {
  if (s.mode === "unconfigured") return <StatusPill tone="destructive">Not configured</StatusPill>;
  return <StatusPill tone={s.mode === "live" ? "success" : "warning"}>{s.mode === "live" ? "Live mode — real payments" : "Test mode — no real money"}</StatusPill>;
}

function PaymentsCard({ settings: s }: { settings: PaymentSettings }) {
  const qc = useQueryClient();
  const [keyId, setKeyId] = useState(s.source === "database" ? (s.keyId ?? "") : "");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmLive, setConfirmLive] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removePassword, setRemovePassword] = useState("");

  const onSaved = (payments: PaymentSettings) => {
    qc.setQueryData(key, payments);
    setKeySecret("");
    setWebhookSecret("");
    setPassword("");
    setErrors({});
  };

  const save = useMutation({
    mutationFn: () =>
      api<{ payments: PaymentSettings }>("/admin/settings/payments", {
        method: "PUT",
        body: { keyId: keyId.trim(), keySecret: keySecret.trim(), webhookSecret: webhookSecret.trim(), currentPassword: password },
      }),
    onSuccess: ({ payments }) => {
      onSaved(payments);
      toast.success(`Razorpay keys verified and saved (${payments.mode} mode)`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details) {
        setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v[0] ?? ""])));
      }
      toast.error(errorMessage(err));
    },
  });

  const test = useMutation({
    mutationFn: () => api<{ ok: boolean; message: string }>("/admin/settings/payments/test", { method: "POST" }),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => api<{ payments: PaymentSettings }>("/admin/settings/payments", { method: "DELETE", body: { currentPassword: removePassword } }),
    onSuccess: ({ payments }) => {
      onSaved(payments);
      setKeyId("");
      setConfirmRemove(false);
      setRemovePassword("");
      toast.success(payments.source === "environment" ? "Saved keys removed — using the server's environment keys" : "Saved keys removed — payments are now off");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const isLiveKey = keyId.trim().startsWith("rzp_live_");
  const submit = () => (isLiveKey && s.mode !== "live" ? setConfirmLive(true) : save.mutate());
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually");
    }
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3">
              <IconChip icon={CreditCard} tone="primary" /> Razorpay payments
            </CardTitle>
            <StatusBadge s={s} />
          </div>
          <CardDescription className="pt-1">
            {s.source === "database" && (
              <>
                Using keys saved here: <span className="font-mono">{s.keyId}</span> · secret ••••{s.keySecretLast4}
                {s.updatedAt ? ` · updated ${new Date(s.updatedAt).toLocaleString("en-IN")}${s.updatedBy ? ` by ${s.updatedBy}` : ""}` : ""}
              </>
            )}
            {s.source === "environment" && (
              <>
                Using keys from the server environment (<span className="font-mono">{s.keyId}</span>). Keys saved here will override them.
              </>
            )}
            {s.source === "none" && "Checkout is disabled until you add your Razorpay keys."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-primary/5 border-primary/20 flex gap-3 rounded-xl border p-3.5 text-sm">
            <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
            Find your keys in the{" "}
            <a href="https://dashboard.razorpay.com/app/website-app-settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 font-medium hover:underline">
              Razorpay Dashboard → Account &amp; Settings → API Keys <ExternalLink className="size-3" aria-hidden />
            </a>
            . Use <strong>Test Mode</strong> keys (<span className="font-mono">rzp_test_…</span>) until you are ready to accept real payments.
            </p>
          </div>

          <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <KeyRound className="size-3.5" aria-hidden /> API keys
          </p>

          <FieldGroup>
            <Field data-invalid={Boolean(errors.keyId)}>
              <FieldLabel htmlFor="keyId">Key ID</FieldLabel>
              <Input id="keyId" value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_XXXXXXXXXXXXXX" autoComplete="off" spellCheck={false} className="font-mono" aria-invalid={Boolean(errors.keyId)} />
              {errors.keyId ? <FieldError>{errors.keyId}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.keySecret)}>
              <FieldLabel htmlFor="keySecret">Key Secret</FieldLabel>
              <PasswordInput
                id="keySecret"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder={s.source === "database" && keyId === s.keyId ? `•••• ${s.keySecretLast4} — leave blank to keep` : "Paste the Key Secret"}
                autoComplete="off"
                aria-invalid={Boolean(errors.keySecret)}
              />
              {errors.keySecret ? <FieldError>{errors.keySecret}</FieldError> : <FieldDescription>Stored encrypted. It is never shown again after saving.</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel htmlFor="webhookSecret">Webhook secret</FieldLabel>
              <PasswordInput
                id="webhookSecret"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={s.webhookSecretSet ? "•••••••• set — leave blank to keep" : "The secret you chose when creating the webhook"}
                autoComplete="off"
              />
              <FieldDescription>Recommended. Lets payments confirm even if the customer closes the browser right after paying.</FieldDescription>
            </Field>
          </FieldGroup>

          <div className="bg-muted/30 space-y-3 rounded-xl border p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Webhook className="text-muted-foreground size-4" aria-hidden /> Webhook setup
              <span className="text-muted-foreground font-normal">(Razorpay → Account &amp; Settings → Webhooks)</span>
            </p>
            <div className="flex gap-2">
              <Input readOnly value={s.webhookUrl} className="bg-background font-mono text-xs" aria-label="Webhook URL" onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" size="icon-lg" className="bg-background" aria-label="Copy webhook URL" onClick={() => copy(s.webhookUrl)}>
                <Copy />
              </Button>
            </div>
            <p className="text-muted-foreground">
              Active events: {s.webhookEvents.map((e) => <code key={e} className="bg-background mr-1 rounded border px-1.5 py-0.5 text-xs">{e}</code>)}
            </p>
            {s.webhookUrl.startsWith("http://localhost") && (
              <p className="text-warning flex gap-1.5 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Razorpay can&apos;t reach localhost. Use a tunnel (ngrok / cloudflared) in development, or set this up after deploying.
              </p>
            )}
          </div>

          <Field data-invalid={Boolean(errors.currentPassword)} className="border-t pt-6">
            <FieldLabel htmlFor="confirm-password">Your admin password</FieldLabel>
            <PasswordInput id="confirm-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} />
            {errors.currentPassword ? <FieldError>{errors.currentPassword}</FieldError> : <FieldDescription>Required to change where payments go.</FieldDescription>}
          </Field>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
          <Button onClick={submit} disabled={save.isPending || !keyId.trim() || !password}>
            {save.isPending ? <Spinner /> : <CheckCircle2 />} Verify &amp; save
          </Button>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || s.mode === "unconfigured"}>
            {test.isPending ? <Spinner /> : <PlugZap />} Test connection
          </Button>
          {s.savedInDashboard && (
            <Button variant="ghost" className="text-destructive hover:text-destructive sm:ml-auto" onClick={() => setConfirmRemove(true)}>
              <Trash2 /> Remove saved keys
            </Button>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={confirmLive} onOpenChange={setConfirmLive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to LIVE payments?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers will be charged real money from the moment you save. Make sure you have completed a full test purchase and refund in test mode first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate()}>Yes, go live</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemove} onOpenChange={(o) => { setConfirmRemove(o); if (!o) setRemovePassword(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the saved Razorpay keys?</AlertDialogTitle>
            <AlertDialogDescription>
              {s.environmentConfigured
                ? "The store will fall back to the keys in the server environment."
                : "Checkout will stop working until new keys are added."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="remove-password">Your admin password</FieldLabel>
            <PasswordInput id="remove-password" value={removePassword} onChange={(e) => setRemovePassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!removePassword || remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? <Spinner /> : null} Remove keys
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
