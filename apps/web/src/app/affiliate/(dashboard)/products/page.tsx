"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, ChevronDown, Copy, Download, Link2, MousePointerClick, SearchX, Share2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@ebook/shared";
import { AffiliateGate } from "@/components/affiliate/affiliate-gate";
import { SearchField } from "@/components/dashboard/list-ui";
import { useAffiliateFormat } from "@/components/affiliate/use-affiliate-format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import type { AffiliateProductDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";

export default function AffiliateProductsPage() {
  const t = useMessages();
  const p = t.affiliate.products;
  return (
    <>
      <PageHeader eyebrow={p.eyebrow} title={t.common.dashboard.affiliate.products} description={p.description} />
      <AffiliateGate>{() => <ProductList />}</AffiliateGate>
    </>
  );
}

function ProductList() {
  const t = useMessages().affiliate.products;
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const { data, isPending } = useQuery({
    queryKey: ["affiliate", "products"],
    queryFn: () => api<{ items: AffiliateProductDto[] }>("/affiliate/products").then((r) => r.items),
  });

  if (isPending) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <Empty className="bg-card rounded-2xl border border-solid">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>{t.emptyTitle}</EmptyTitle>
          <EmptyDescription>{t.emptyBody}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const visible = query ? data.filter((p) => `${p.title} ${p.subtitle} ${p.author}`.toLowerCase().includes(query)) : data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ol aria-label={t.stepsLabel} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          {t.steps.map((step, i) => (
            <li key={step} className="text-muted-foreground flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
              <span className="text-foreground font-medium">{step}</span>
              {i < t.steps.length - 1 ? <span aria-hidden className="bg-border hidden h-px w-6 sm:block" /> : null}
            </li>
          ))}
        </ol>
        {data.length > 3 ? (
          <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} className="md:max-w-xs" />
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Empty className="bg-card rounded-2xl border border-solid">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>{t.noMatch}</EmptyTitle>
            <EmptyDescription>{t.noMatchBody}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((p) => (
            <ProductCard key={p.productId} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product: p }: { product: AffiliateProductDto }) {
  const messages = useMessages();
  const t = messages.affiliate.products;
  const fmt = useAffiliateFormat();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api<{ link: AffiliateProductDto["link"] }>("/affiliate/links", { method: "POST", body: { productId: p.productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliate", "products"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const copy = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
      return true;
    } catch {
      toast.error(messages.affiliate.common.copyFailed);
      return false;
    }
  };

  const copyLink = async () => {
    if (!p.link) return;
    if (await copy(p.link.url, t.linkCopied)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  // Cards render only in the browser (after the query resolves), so this check is hydration-safe.
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async () => {
    if (!p.link) return;
    try {
      await navigator.share({ title: p.title, url: p.link.url });
    } catch {
      // Closing the share sheet rejects — nothing to report.
    }
  };

  const rate = p.commission.type === "percent" ? t.percentOfSale(fmt.rate(p.commission)) : t.fixedPerSale(fmt.rate(p.commission));

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0">
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        <BookCover src={p.coverUrl} title={p.title} className="w-20 shrink-0 self-start rounded-lg shadow-sm sm:w-24" sizes="96px" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-0.5">
            <h2 className="leading-snug font-semibold text-balance">{p.title}</h2>
            {p.subtitle ? <p className="text-muted-foreground line-clamp-2 text-sm">{p.subtitle}</p> : null}
          </div>
          <div className="bg-success/8 border-success/20 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5">
            <div>
              <p className="text-muted-foreground text-xs">{t.earnPerSale}</p>
              <p className="text-success text-xl font-semibold tracking-tight tabular-nums">{formatINR(p.commission.perSalePaise)}</p>
            </div>
            <p className="text-muted-foreground text-xs">{rate}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            {t.price}: <span className="text-foreground font-medium tabular-nums">{formatINR(p.effectivePricePaise)}</span>
          </p>
        </div>
      </div>

      <div className="bg-muted/40 space-y-3 border-t p-4 sm:px-5">
        {p.link ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">{t.referralLink}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                <MousePointerClick className="size-3.5" aria-hidden /> {t.clicksSoFar(p.link.clicks)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Link2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" aria-hidden />
                <Input
                  readOnly
                  value={p.link.url}
                  aria-label={t.linkFor(p.title)}
                  onFocus={(e) => e.target.select()}
                  className="bg-background h-10 pl-8 font-mono text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button size="lg" className="flex-1 sm:flex-none" onClick={copyLink} aria-label={t.copyLinkFor(p.title)}>
                  {copied ? <Check /> : <Copy />} {copied ? messages.affiliate.common.copied : t.copyLink}
                </Button>
                {canShare ? (
                  <Button size="lg" variant="outline" className="bg-background" onClick={share} aria-label={t.share}>
                    <Share2 />
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <Button size="lg" className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Link2 />} {t.getLink}
          </Button>
        )}

        {p.coverUrl || p.description ? (
          <details className="group text-sm">
            <summary className="text-primary flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
              {t.materials}
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 space-y-3">
              {p.description && (
                <p className="bg-background text-muted-foreground max-h-40 overflow-y-auto rounded-lg border p-3 whitespace-pre-line">{p.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {p.description && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background"
                    onClick={() => copy(`${p.title}\n\n${p.description}${p.link ? `\n\n${p.link.url}` : ""}`, t.descriptionCopied)}
                  >
                    <Copy /> {p.link ? t.copyDescriptionWithLink : t.copyDescription}
                  </Button>
                )}
                {p.coverUrl && (
                  <Button asChild variant="outline" size="sm" className="bg-background">
                    <a href={p.coverUrl} download={`${p.slug}-cover.webp`}>
                      <Download /> {t.downloadCover}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
