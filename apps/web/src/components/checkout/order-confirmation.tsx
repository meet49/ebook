"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, MailCheck, XCircle } from "lucide-react";
import { formatINR, type OrderStatus } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface OrderStatusResponse {
  orderNumber: string;
  status: OrderStatus;
  product: { title: string; slug: string };
  amountPaise: number;
  maskedEmail: string | null;
  isOwner: boolean;
}

export function OrderConfirmation() {
  const orderNumber = useSearchParams().get("order") ?? "";
  const { data, isError } = useQuery({
    queryKey: ["checkout", "order", orderNumber],
    queryFn: () => api<OrderStatusResponse>(`/checkout/orders/${encodeURIComponent(orderNumber)}`),
    enabled: Boolean(orderNumber),
    // Keep checking for up to ~2 minutes while the webhook confirms the payment.
    refetchInterval: (q) => (q.state.data?.status === "created" && q.state.dataUpdateCount < 60 ? 2000 : false),
  });

  if (!orderNumber || isError) {
    return (
      <Card className="w-full text-center">
        <CardContent className="space-y-4">
          <XCircle className="text-destructive mx-auto size-10" aria-hidden />
          <p>We couldn&apos;t find this order. If you were charged, please contact support with your payment reference.</p>
          <Button asChild variant="outline">
            <Link href="/ebooks">Back to store</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex w-full items-center justify-center gap-2" role="status">
        <Spinner /> Loading your order…
      </div>
    );
  }

  const paid = data.status === "paid" || data.status === "partially_refunded";
  return (
    <Card className="w-full">
      <CardContent className="space-y-5 text-center">
        {paid ? (
          <CheckCircle2 className="text-success mx-auto size-12" aria-hidden />
        ) : data.status === "created" ? (
          <Clock className="text-warning mx-auto size-12" aria-hidden />
        ) : (
          <XCircle className="text-destructive mx-auto size-12" aria-hidden />
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {paid ? "Payment successful!" : data.status === "created" ? "Confirming your payment…" : "Payment not completed"}
          </h1>
          <p className="text-muted-foreground">
            {data.product.title} · {formatINR(data.amountPaise)}
          </p>
          <p className="text-muted-foreground text-xs">Order {data.orderNumber}</p>
        </div>

        {paid && data.isOwner && (
          <Button asChild size="lg" className="w-full">
            <Link href={`/read/${data.product.slug}`}>Start reading</Link>
          </Button>
        )}

        {paid && !data.isOwner && (
          <div className="bg-accent text-accent-foreground flex gap-3 rounded-xl p-4 text-left text-sm">
            <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              We&apos;ve emailed a secure sign-in link to <strong>{data.maskedEmail}</strong>. Open it to access your library.
              Didn&apos;t get it? Check spam, or{" "}
              <Link href="/login" className="underline">
                request a new sign-in link
              </Link>
              .
            </p>
          </div>
        )}

        {data.status === "created" && (
          <p className="text-muted-foreground text-sm">
            This usually takes a few seconds. If money was deducted, your book will be added as soon as the bank confirms — you
            don&apos;t need to pay again.
          </p>
        )}

        {(data.status === "failed" || data.status === "refunded") && (
          <Button asChild variant="outline">
            <Link href={`/checkout/${data.product.slug}`}>Try again</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
