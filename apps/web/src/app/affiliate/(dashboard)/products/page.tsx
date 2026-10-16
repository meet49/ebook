"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatINR } from "@ebook/shared";
import { AffiliateGate } from "@/components/affiliate/affiliate-gate";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { commissionLabel, type AffiliateProductDto } from "@/lib/affiliate";
import { api, errorMessage } from "@/lib/api";

export default function AffiliateProductsPage() {
  return (
    <>
      <PageHeader title="Products & links" description="Every eBook you can promote, with your commission per verified sale." />
      <AffiliateGate>{() => <ProductList />}</AffiliateGate>
    </>
  );
}

function ProductList() {
  const { data, isPending } = useQuery({
    queryKey: ["affiliate", "products"],
    queryFn: () => api<{ items: AffiliateProductDto[] }>("/affiliate/products").then((r) => r.items),
  });
  if (isPending) return <Skeleton className="h-64" />;
  if (!data?.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No eBooks to promote yet</EmptyTitle>
          <EmptyDescription>Published eBooks with affiliate commission will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="space-y-4">
      {data.map((p) => (
        <ProductRow key={p.productId} product={p} />
      ))}
    </div>
  );
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy — select the text and copy it manually.");
  }
}

function ProductRow({ product: p }: { product: AffiliateProductDto }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api<{ link: AffiliateProductDto["link"] }>("/affiliate/links", { method: "POST", body: { productId: p.productId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliate", "products"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 sm:flex-row">
        <BookCover src={p.coverUrl} title={p.title} className="w-24 shrink-0 self-start" sizes="96px" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-semibold">{p.title}</h2>
            {p.subtitle ? <p className="text-muted-foreground text-sm">{p.subtitle}</p> : null}
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Price</dt>
              <dd className="font-medium tabular-nums">{formatINR(p.effectivePricePaise)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Commission</dt>
              <dd className="font-medium">{commissionLabel(p.commission)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">You earn per sale</dt>
              <dd className="text-success font-semibold tabular-nums">{formatINR(p.commission.perSalePaise)}</dd>
            </div>
          </dl>

          {p.link ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={p.link.url} aria-label={`Referral link for ${p.title}`} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                <Button
                  onClick={async () => {
                    await copy(p.link!.url, "Link");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />} Copy
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{p.link.clicks} clicks so far</p>
            </div>
          ) : (
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Spinner /> : <Link2 />} Get my referral link
            </Button>
          )}

          <details className="text-sm">
            <summary className="text-primary cursor-pointer font-medium">Promotional materials</summary>
            <div className="mt-3 space-y-3">
              {p.coverUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={p.coverUrl} download={`${p.slug}-cover.webp`}>
                    <Download /> Download cover image
                  </a>
                </Button>
              )}
              {p.description && (
                <div className="space-y-2">
                  <p className="bg-muted/60 text-muted-foreground max-h-40 overflow-y-auto rounded-lg p-3 whitespace-pre-line">{p.description}</p>
                  <Button variant="outline" size="sm" onClick={() => copy(`${p.title}\n\n${p.description}${p.link ? `\n\n${p.link.url}` : ""}`, "Description")}>
                    <Copy /> Copy description{p.link ? " with link" : ""}
                  </Button>
                </div>
              )}
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
