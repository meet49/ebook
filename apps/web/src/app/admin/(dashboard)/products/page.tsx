"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { formatINR, formatUSD, type ProductStatus } from "@ebook/shared";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { ProductStatusBadge } from "@/components/admin/product-status";
import { FilterPills, ListCard, SearchField } from "@/components/dashboard/list-ui";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminProducts } from "@/lib/admin-products";
import { cn } from "@/lib/utils";
import { AdminPager, ListEmpty, ListError, ListSkeleton } from "../_components/admin-list";

const FILTERS: { value: ProductStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "in_review", label: "In review" },
  { value: "draft", label: "Drafts" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
];

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function AdminProductsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [page, setPage] = useState(1);
  const deferredQ = useDeferredValue(q.trim());
  const { data, isPending, isError, refetch, isPlaceholderData } = useAdminProducts({
    q: deferredQ || undefined,
    status: status === "all" ? undefined : status,
    page,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(deferredQ) || status !== "all";

  return (
    <>
      <PageHeader
        eyebrow="Store"
        title="eBooks"
        description="Create, price and publish your eBooks. Published titles appear in the store automatically."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/products/new">
              <Plus /> New eBook
            </Link>
          </Button>
        }
      />

      <ListCard
        toolbar={
          <>
            <FilterPills
              label="Filter by status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={FILTERS}
            />
            <SearchField
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, slug or author"
              aria-label="Search eBooks"
              className="lg:max-w-xs"
            />
          </>
        }
      >
        {isError ? (
          <ListError title="Couldn't load eBooks" onRetry={() => refetch()} />
        ) : isPending ? (
          <ListSkeleton rows={5} height="h-16" />
        ) : data.items.length === 0 ? (
          <ListEmpty
            icon={BookOpen}
            title={filtered ? "No matching eBooks" : "No eBooks yet"}
            description={filtered ? "Try another filter." : "Create your first eBook to start selling."}
          >
            {!filtered && (
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus /> New eBook
                </Link>
              </Button>
            )}
          </ListEmpty>
        ) : (
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            {/* Phones: stacked rows */}
            <ul className="divide-y md:hidden">
              {data.items.map((p) => (
                <li key={p.id} className="pb-3">
                  <Link href={`/admin/products/${p.id}`} className="hover:bg-muted/50 flex items-center gap-3 p-4 pb-2 transition-colors">
                    <BookCover src={p.coverUrl} title={p.title} className="w-12 shrink-0 rounded-md" sizes="48px" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-medium">{p.title}</span>
                      <ProductStatusBadge status={p.status} processing={p.processing.status} />
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {formatINR(p.effectivePricePaise)}
                        {p.pageCount ? ` · ${p.pageCount} pages` : ""}
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </Link>
                  <ProductRowActions product={p} className="pl-19" />
                </li>
              ))}
            </ul>

            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">eBook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="pl-4">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <BookCover src={p.coverUrl} title={p.title} className="w-10 shrink-0 rounded-md shadow-sm" sizes="40px" />
                        <span className="min-w-0">
                          <span className="block max-w-72 truncate font-medium group-hover:underline">{p.title}</span>
                          <span className="text-muted-foreground block truncate font-mono text-xs">/ebooks/{p.slug}</span>
                          {p.authorProfile ? <span className="text-primary block truncate text-xs">by {p.authorProfile.penName}</span> : null}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={p.status} processing={p.processing.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-medium">{formatINR(p.effectivePricePaise)}</span>
                      {p.salePricePaise != null && <span className="text-muted-foreground ml-1 text-xs line-through">{formatINR(p.pricePaise)}</span>}
                      {p.comboPricePaise != null && <span className="text-primary block text-xs">Combo {formatINR(p.comboPricePaise)}</span>}
                      {p.intlPriceCents != null && <span className="text-muted-foreground block text-xs">Intl {formatUSD(p.intlPriceCents)}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{p.pageCount || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{dateFmt.format(new Date(p.updatedAt))}</TableCell>
                    <TableCell className="pr-4">
                      <ProductRowActions product={p} className="justify-end" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data ? <AdminPager page={page} totalPages={totalPages} onPage={setPage} summary={`${data.total} eBooks`} /> : null}
      </ListCard>
    </>
  );
}
