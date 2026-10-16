"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, ShieldCheck } from "lucide-react";
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
      (message) => toast.error(`${message} You can try again.`),
    );
  };

  const busy = stage !== "idle";
  const label =
    stage === "creating" ? "Preparing secure checkout…" : stage === "paying" ? "Complete payment in the window…" : stage === "verifying" ? "Confirming payment…" : `Pay ${formatINR(amountPaise)}`;

  if (isPending) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-5">
      {owned ? (
        <div className="bg-accent text-accent-foreground space-y-3 rounded-xl p-4 text-sm" role="status">
          <p className="font-medium">{owned}</p>
          <Button asChild size="sm">
            <Link href={user ? `/read/${slug}` : `/login?next=${encodeURIComponent(`/read/${slug}`)}`}>
              {user ? "Read now" : "Sign in to read"}
            </Link>
          </Button>
        </div>
      ) : null}

      {user ? (
        <div className="space-y-4">
          <p className="text-sm">
            Buying as <span className="font-medium">{user.email}</span>. The book will appear in your library.
          </p>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void pay()}>
            {busy ? <Spinner /> : <Lock />} {label}
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((v) => pay(v))} className="space-y-5">
          <FieldGroup>
            <FormField control={form.control} name="name" label="Full name">
              {({ field, id, invalid }) => <Input id={id} autoComplete="name" aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField
              control={form.control}
              name="email"
              label="Email"
              description="Your library access link and receipt are sent here."
            >
              {({ field, id, invalid }) => <Input id={id} type="email" autoComplete="email" aria-invalid={invalid} {...field} />}
            </FormField>
          </FieldGroup>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : <Lock />} {label}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`} className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5" aria-hidden /> Payments are processed securely by Razorpay. We never see your card details.
      </p>
    </div>
  );
}
