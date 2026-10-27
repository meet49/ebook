"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, EyeOff, Info, MessageSquareWarning, Send, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AdminProduct } from "@ebook/shared";
import { ProductFiles } from "@/components/admin/product-files";
import { ProductForm } from "@/components/admin/product-form";
import { AuthorBookStatus } from "@/components/author/book-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { useAdminProduct, useDeleteProduct, useProductAction, useUpdateProduct } from "@/lib/admin-products";
import { ApiError, errorMessage } from "@/lib/api";

const BASE = "/author/products" as const;

export default function AuthorEditBookPage() {
  const { id } = useParams<{ id: string }>();
  const m = useMessages();
  const t = m.author.editor;
  const { data: product, isPending, isError, error, refetch } = useAdminProduct(id, BASE);
  const update = useUpdateProduct(id, BASE);

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
          <EmptyTitle>{missing ? t.notFound : errorMessage(error)}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button asChild variant="outline">
            <Link href="/author">{t.back}</Link>
          </Button>
          {!missing && <Button onClick={() => refetch()}>{m.common.actions.tryAgain}</Button>}
        </EmptyContent>
      </Empty>
    );
  }

  const editable = product.status === "draft" || product.status === "unpublished";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/author">
          <ArrowLeft /> {t.back}
        </Link>
      </Button>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <AuthorBookStatus status={product.status} />
        </div>
        <StatusActions product={product} />
      </div>

      <StatusBanner product={product} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="order-2 lg:order-1">
          <fieldset disabled={!editable} className="disabled:opacity-70">
            <ProductForm
              variant="author"
              product={product}
              submitLabel={t.save}
              disabled={!editable}
              onSubmit={async (input) => {
                await update.mutateAsync(input);
                toast.success(t.saved);
              }}
            />
          </fieldset>
        </div>
        <div className="order-1 lg:sticky lg:top-20 lg:order-2">
          {editable ? <ProductFiles product={product} base={BASE} /> : null}
        </div>
      </div>
    </>
  );
}

function StatusBanner({ product }: { product: AdminProduct }) {
  const t = useMessages().author.editor;
  const banner = (icon: LucideIcon, tone: string, children: ReactNode) => {
    const Icon = icon;
    return (
      <Card className={`mb-6 py-4 ${tone}`}>
        <CardContent className="flex gap-3 text-sm">
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex-1">{children}</div>
        </CardContent>
      </Card>
    );
  };

  if (product.status === "in_review") return banner(Info, "border-primary/30 bg-primary/5", <p>{t.inReview}</p>);
  if (product.status === "published") return banner(Info, "border-success/30 bg-success/5", <p>{t.live}</p>);
  return (
    <>
      {product.reviewNote && product.status === "draft"
        ? banner(MessageSquareWarning, "border-warning/40 bg-warning/5", <p className="font-medium">{t.changesRequested(product.reviewNote)}</p>)
        : null}
      {product.status === "unpublished" ? banner(Info, "border-warning/30 bg-warning/5", <p>{t.outOfStore}</p>) : null}
      {product.publishBlockers.length > 0
        ? banner(
            AlertTriangle,
            "border-warning/40 bg-warning/5",
            <>
              <p className="font-medium">{t.notReady}</p>
              <ul className="text-muted-foreground mt-1 list-disc pl-5">
                {product.publishBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>,
          )
        : banner(Send, "border-primary/30 bg-primary/5", <p>{t.submitHint}</p>)}
    </>
  );
}

function StatusActions({ product }: { product: AdminProduct }) {
  const m = useMessages();
  const t = m.author.editor;
  const router = useRouter();
  const action = useProductAction(product.id, BASE);
  const remove = useDeleteProduct(BASE);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (a: "submit" | "withdraw", done: string) =>
    action.mutate(a, {
      onSuccess: () => toast.success(done),
      onError: (err) => {
        const details = err instanceof ApiError ? err.details?.publish : undefined;
        toast.error(details?.length ? `${err.message}: ${details.join("; ")}` : errorMessage(err));
      },
    });

  return (
    <div className="flex flex-wrap gap-2">
      {product.status === "published" && (
        <Button asChild variant="outline" aria-label={product.title}>
          <Link href={`/ebooks/${product.slug}`} target="_blank">
            <ExternalLink />
          </Link>
        </Button>
      )}
      {(product.status === "draft" || product.status === "unpublished") && (
        <Button onClick={() => run("submit", t.submitted)} disabled={action.isPending || product.publishBlockers.length > 0}>
          {action.isPending ? <Spinner /> : <Send />} {t.submit}
        </Button>
      )}
      {product.status === "in_review" && (
        <Button variant="outline" onClick={() => run("withdraw", t.withdrawn)} disabled={action.isPending}>
          <Undo2 /> {t.withdraw}
        </Button>
      )}
      {product.status === "published" && (
        <Button variant="outline" onClick={() => run("withdraw", t.takenOut)} disabled={action.isPending}>
          <EyeOff /> {t.takeOut}
        </Button>
      )}
      {product.status === "draft" && (
        <Button variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={remove.isPending} onClick={() => setConfirmDelete(true)}>
          <Trash2 /> {t.delete}
        </Button>
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                remove.mutate(product.id, {
                  onSuccess: () => {
                    toast.success(t.deleted);
                    router.replace("/author");
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
