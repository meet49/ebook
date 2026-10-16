"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Clock, MailCheck, XCircle } from "lucide-react";
import { formatINR, type OrderStatus } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface OrderStatusResponse {
  orderNumber: string;
  status: OrderStatus;
  product: { title: string; slug: string };
  amountPaise: number;
  maskedEmail: string | null;
  isOwner: boolean;
}

const card = "bg-card w-full overflow-hidden rounded-3xl border shadow-xl shadow-indigo-900/5";

export function OrderConfirmation() {
  const t = useMessages().checkout.confirmation;
  const reduceMotion = useReducedMotion();
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
      <div className={cn(card, "space-y-5 p-6 text-center sm:p-8")}>
        <span className="bg-destructive/10 text-destructive mx-auto flex size-14 items-center justify-center rounded-full">
          <XCircle className="size-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{t.notFound}</h1>
          <p className="text-muted-foreground text-sm text-pretty">{t.notFoundBody}</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/ebooks">{t.backToStore}</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground flex w-full items-center justify-center gap-2" role="status">
        <Spinner /> {t.loading}
      </div>
    );
  }

  const paid = data.status === "paid" || data.status === "partially_refunded";
  const pending = data.status === "created";
  const tone = paid ? "success" : pending ? "pending" : "failed";

  return (
    <motion.div
      key={tone}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={card}
    >
      <div
        className={cn(
          "relative isolate px-6 pt-8 pb-6 text-center sm:px-8",
          paid && "from-success/15 bg-linear-to-b to-transparent",
          pending && "from-warning/15 bg-linear-to-b to-transparent",
          !paid && !pending && "from-destructive/10 bg-linear-to-b to-transparent",
        )}
      >
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-50" />
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full ring-8",
            paid && "bg-success/15 text-success ring-success/5",
            pending && "bg-warning/15 text-warning ring-warning/5",
            !paid && !pending && "bg-destructive/10 text-destructive ring-destructive/5",
          )}
        >
          {paid ? (
            <CheckCircle2 className="size-8" aria-hidden />
          ) : pending ? (
            <Clock className="size-8 motion-safe:animate-pulse" aria-hidden />
          ) : (
            <XCircle className="size-8" aria-hidden />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl" aria-live="polite">
          {paid ? t.paid : pending ? t.pending : t.failed}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm text-pretty">
          {paid ? t.paidBody : pending ? t.pendingBody : t.failedBody}
        </p>
      </div>

      <div className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
        <dl className="bg-muted/40 divide-y rounded-2xl border text-sm">
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground shrink-0">{t.book}</dt>
            <dd className="text-right font-medium">{data.product.title}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">{t.amount}</dt>
            <dd className="font-semibold tabular-nums">{formatINR(data.amountPaise)}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">{t.order}</dt>
            <dd className="font-mono text-xs break-all">{data.orderNumber}</dd>
          </div>
        </dl>

        {paid && data.isOwner && (
          <Button asChild size="lg" className="h-12 w-full rounded-full text-base shadow-lg shadow-indigo-900/15">
            <Link href={`/read/${data.product.slug}`}>
              <BookOpen aria-hidden /> {t.startReading}
            </Link>
          </Button>
        )}

        {paid && !data.isOwner && (
          <div className="border-primary/20 bg-accent text-accent-foreground flex gap-3 rounded-2xl border p-4 text-left text-sm">
            <MailCheck className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              {t.emailSentBefore} <strong>{data.maskedEmail}</strong>. {t.emailSentAfter} {t.noEmail}{" "}
              <Link href="/login" className="font-medium underline underline-offset-2">
                {t.requestLink}
              </Link>
              .
            </p>
          </div>
        )}

        {(data.status === "failed" || data.status === "refunded") && (
          <Button asChild size="lg" className="w-full rounded-full">
            <Link href={`/checkout/${data.product.slug}`}>{t.tryAgain}</Link>
          </Button>
        )}

        <div className="text-center">
          <Link href="/ebooks" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
            {t.browseMore} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
