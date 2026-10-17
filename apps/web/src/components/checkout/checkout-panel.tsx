"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpenCheck, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { emailSchema, formatINR, nameSchema } from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { ApiError, api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { handleFormError } from "@/lib/forms";
import { loadRazorpay, openRazorpay, type RazorpaySuccess } from "@/lib/razorpay";
import { SITE_NAME } from "@/lib/site";

interface CreatedOrder {
  orderNumber: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  product: { title: string; slug: string };
  prefill: { name: string; email: string };
}

const guestSchema = z.object({ name: nameSchema, email: emailSchema });
type GuestValues = z.infer<typeof guestSchema>;

export function CheckoutPanel({ slug, amountPaise }: { slug: string; amountPaise: number }) {
  const t = useMessages().checkout;
  const router = useRouter();
  const { data: user, isPending } = useMe();
  const [stage, setStage] = useState<"idle" | "creating" | "paying" | "verifying">("idle");
  const [owned, setOwned] = useState<string | null>(null);
  const form = useForm<GuestValues>({ resolver: zodResolver(guestSchema), defaultValues: { name: "", email: "" } });

  const verify = async (order: CreatedOrder, res: RazorpaySuccess) => {
    setStage("verifying");
    try {
      await api("/checkout/verify", { method: "POST", body: res });
    } catch (err) {
      // The webhook confirms independently; the success page polls the final status.
      if (!(err instanceof ApiError && err.code === "PAYMENT_NOT_CAPTURED")) toast.error((err as Error).message);
    }
    router.replace(`/checkout/success?order=${encodeURIComponent(order.orderNumber)}`);
  };

  const pay = async (guest?: GuestValues) => {
    setOwned(null);
    setStage("creating");
    let order: CreatedOrder;
    try {
      const [created] = await Promise.all([
        api<CreatedOrder>("/checkout/orders", { method: "POST", body: { productSlug: slug, ...guest } }),
        loadRazorpay(),
      ]);
      order = created;
    } catch (err) {
      setStage("idle");
      if (err instanceof ApiError && err.code === "ALREADY_OWNED") {
        setOwned(err.message);
        return;
      }
      handleFormError(err, form.setError);
      return;
    }

    setStage("paying");
    openRazorpay(
      {
        key: order.keyId,
        order_id: order.razorpayOrderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: SITE_NAME,
        description: order.product.title,
        prefill: order.prefill,
        handler: (res) => void verify(order, res),
        modal: { ondismiss: () => setStage("idle"), confirm_close: true },
      },
      (message) => toast.error(`${message} ${t.tryAgainSuffix}`),
    );
  };

  const busy = stage !== "idle";
  const label = stage === "idle" ? t.pay(formatINR(amountPaise)) : t.stage[stage];
  const payClass = "h-12 w-full rounded-full text-base shadow-lg shadow-indigo-900/15";

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-12 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {owned ? (
        <div className="border-primary/20 bg-accent text-accent-foreground flex flex-col gap-3 rounded-2xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="flex items-start gap-2.5 font-medium">
            <BookOpenCheck className="text-primary mt-0.5 size-4.5 shrink-0" aria-hidden />
            {t.alreadyOwned}
          </p>
          <Button asChild size="sm" className="shrink-0 rounded-full px-4">
            <Link href={user ? `/read/${slug}` : `/login?next=${encodeURIComponent(`/read/${slug}`)}`}>
              {user ? t.readNow : t.signInToRead}
            </Link>
          </Button>
        </div>
      ) : null}

      {user ? (
        <div className="space-y-5">
          <div className="bg-muted/50 flex items-center gap-3 rounded-2xl border p-4">
            <span className="bg-gradient-brand flex size-10 shrink-0 items-center justify-center rounded-full text-white">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-muted-foreground text-xs">{t.buyingAs}</p>
              <p className="truncate font-semibold">{user.email}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{t.buyingAsHint}</p>
            </div>
          </div>
          <Button size="lg" className={payClass} disabled={busy} onClick={() => void pay()}>
            {busy ? <Spinner /> : <Lock />} {label}
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((v) => pay(v))} className="space-y-6">
          <FieldGroup>
            <FormField control={form.control} name="name" label={t.form.name}>
              {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} className="h-11 rounded-xl" {...field} />}
            </FormField>
            <FormField control={form.control} name="email" label={t.form.email} description={t.form.emailHint}>
              {({ field, id, invalid }) => (
                <Input id={id} type="email" inputMode="email" autoComplete="email" aria-invalid={invalid} className="h-11 rounded-xl" {...field} />
              )}
            </FormField>
          </FieldGroup>
          <Button type="submit" size="lg" className={payClass} disabled={busy}>
            {busy ? <Spinner /> : <Lock />} {label}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t.haveAccount}{" "}
            <Link href={`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`} className="text-primary font-medium hover:underline">
              {t.signIn}
            </Link>
          </p>
        </form>
      )}

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        {t.agree.before}{" "}
        <Link href="/legal/terms" target="_blank" className="text-foreground underline underline-offset-2">
          {t.agree.terms}
        </Link>{" "}
        {t.agree.and}{" "}
        <Link href="/legal/refunds" target="_blank" className="text-foreground underline underline-offset-2">
          {t.agree.refunds}
        </Link>
        {t.agree.after}
      </p>

      <p className="text-muted-foreground flex items-start justify-center gap-1.5 border-t pt-5 text-center text-xs">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden /> {t.secureNote}
      </p>
    </div>
  );
}
