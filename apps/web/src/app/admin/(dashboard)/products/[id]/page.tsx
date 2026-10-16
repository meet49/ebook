"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Archive, ArrowLeft, ExternalLink, EyeOff, RotateCcw, Rocket, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminProduct } from "@ebook/shared";
import { ProductFiles } from "@/components/admin/product-files";
import { ProductForm } from "@/components/admin/product-form";
import { ProductStatusBadge } from "@/components/admin/product-status";
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
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminProduct, useProductAction, useUpdateProduct, type ProductAction } from "@/lib/admin-products";
import { ApiError, errorMessage } from "@/lib/api";

const CONFIRM: Record<Exclude<ProductAction, "reprocess">, { title: string; body: string; label: string; destructive?: boolean }> = {
  publish: { title: "Publish this eBook?", body: "It will appear in the store and can be bought immediately.", label: "Publish" },
  unpublish: {
    title: "Unpublish this eBook?",
    body: "It will be hidden from the store. Customers who already bought it keep access.",
    label: "Unpublish",
  },
  archive: {
    title: "Archive this eBook?",
    body: "It will be hidden from the store and the admin list's default views. Existing buyers keep access.",
    label: "Archive",
    destructive: true,
  },
  restore: { title: "Restore this eBook?", body: "It will return to drafts so you can edit and publish it again.", label: "Restore" },
};

const DONE: Record<Exclude<ProductAction, "reprocess">, string> = {
  publish: "Published — it's now live in the store",
  unpublish: "Unpublished",
  archive: "Archived",
  restore: "Restored to drafts",
};

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch } = useAdminProduct(id);
  const update = useUpdateProduct(id);
  const [pending, setPending] = useState<Exclude<ProductAction, "reprocess"> | null>(null);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-150" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyTitle>{missing ? "eBook not found" : "Couldn't load this eBook"}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button asChild variant="outline">
            <Link href="/admin/products">All eBooks</Link>
          </Button>
          {!missing && <Button onClick={() => refetch()}>Try again</Button>}
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/products">
          <ArrowLeft /> All eBooks
        </Link>
      </Button>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <ProductStatusBadge status={product.status} processing={product.processing.status} />
        </div>
        <StatusActions product={product} pending={pending} setPending={setPending} />
      </div>

      {product.publishBlockers.length > 0 && product.status !== "archived" && product.status !== "published" && (
        <Card className="border-warning/40 bg-warning/5 mb-6 py-4">
          <CardContent className="flex gap-3">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">Before you can publish:</p>
              <ul className="text-muted-foreground mt-1 list-disc pl-5">
                {product.publishBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {product.publishBlockers.length === 0 && (product.status === "draft" || product.status === "unpublished") && (
        <Card className="border-primary/30 bg-primary/5 mb-6 py-4">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Store className="text-primary size-5 shrink-0" aria-hidden />
            <div className="flex-1 text-sm">
              <p className="font-medium">This eBook is not visible in the store yet.</p>
              <p className="text-muted-foreground">
                It is {product.status}. Publish it so it shows on the home page and in the catalogue and customers can buy it.
              </p>
            </div>
            <Button onClick={() => setPending("publish")}>
              <Rocket /> Publish now
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="order-2 lg:order-1">
          <ProductForm
            product={product}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await update.mutateAsync(input);
              toast.success("Changes saved");
            }}
          />
        </div>
        <div className="order-1 lg:sticky lg:top-20 lg:order-2">
          <ProductFiles product={product} />
        </div>
      </div>
    </>
  );
}

type ConfirmableAction = Exclude<ProductAction, "reprocess">;

function StatusActions({
  product,
  pending,
  setPending,
}: {
  product: AdminProduct;
  pending: ConfirmableAction | null;
  setPending: (a: ConfirmableAction | null) => void;
}) {
  const action = useProductAction(product.id);
  const confirm = pending ? CONFIRM[pending] : null;

  const run = (a: ConfirmableAction) =>
    action.mutate(a, {
      onSuccess: () => toast.success(DONE[a]),
      onError: (err) => {
        const details = err instanceof ApiError ? err.details?.publish : undefined;
        toast.error(details?.length ? `${err.message}: ${details.join("; ")}` : errorMessage(err));
      },
    });

  return (
    <div className="flex flex-wrap gap-2">
      {product.status === "published" && (
        <Button asChild variant="outline">
          <Link href={`/ebooks/${product.slug}`} target="_blank">
            <ExternalLink /> View in store
          </Link>
        </Button>
      )}
      {(product.status === "draft" || product.status === "unpublished") && (
        <Button onClick={() => setPending("publish")} disabled={action.isPending || product.publishBlockers.length > 0}>
          <Rocket /> Publish
        </Button>
      )}
      {product.status === "published" && (
        <Button variant="outline" onClick={() => setPending("unpublish")} disabled={action.isPending}>
          <EyeOff /> Unpublish
        </Button>
      )}
      {product.status !== "archived" ? (
        <Button variant="ghost" onClick={() => setPending("archive")} disabled={action.isPending}>
          <Archive /> Archive
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setPending("restore")} disabled={action.isPending}>
          <RotateCcw /> Restore
        </Button>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={confirm?.destructive ? "destructive" : "default"} onClick={() => pending && run(pending)}>
              {confirm?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
