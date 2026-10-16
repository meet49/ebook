"use client";

import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { formatINR, type ProductStatus } from "@ebook/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { ProductStatusBadge } from "@/components/admin/product-status";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminProducts } from "@/lib/admin-products";

const FILTERS: { value: ProductStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
];

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

  return (
    <>
      <PageHeader
        title="eBooks"
        description="Create, price and publish your eBooks. Published titles appear in the store automatically."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> New eBook
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as ProductStatus | "all");
            setPage(1);
          }}
        >
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full md:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search title, slug or author"
            className="pl-9"
            aria-label="Search eBooks"
          />
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        {isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Couldn&apos;t load eBooks</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </EmptyContent>
          </Empty>
        ) : isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>{deferredQ || status !== "all" ? "No matching eBooks" : "No eBooks yet"}</EmptyTitle>
              <EmptyDescription>
                {deferredQ || status !== "all" ? "Try another filter." : "Create your first eBook to start selling."}
              </EmptyDescription>
            </EmptyHeader>
            {!deferredQ && status === "all" && (
              <EmptyContent>
                <Button asChild>
                  <Link href="/admin/products/new">
                    <Plus /> New eBook
                  </Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table className={isPlaceholderData ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">eBook</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead className="pr-4">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="pl-4">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <BookCover src={p.coverUrl} title={p.title} className="w-10 shrink-0 rounded-md" sizes="40px" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">{p.title}</span>
                        <span className="text-muted-foreground block truncate text-xs">/ebooks/{p.slug}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge status={p.status} processing={p.processing.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatINR(p.effectivePricePaise)}
                    {p.salePricePaise != null && (
                      <span className="text-muted-foreground ml-1 text-xs line-through">{formatINR(p.pricePaise)}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{p.pageCount || "—"}</TableCell>
                  <TableCell className="text-muted-foreground pr-4">{new Date(p.updatedAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
