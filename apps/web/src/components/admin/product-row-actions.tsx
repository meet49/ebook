"use client";

import Link from "next/link";
import { ExternalLink, EyeOff, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AdminProduct } from "@ebook/shared";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeleteProduct, useProductAction } from "@/lib/admin-products";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Publish / unpublish and delete, right from the eBooks list. */
export function ProductRowActions({ product: p, className }: { product: AdminProduct; className?: string }) {
  const action = useProductAction(p.id);
  const remove = useDeleteProduct();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canPublish = p.status === "draft" || p.status === "unpublished";
  const blocked = canPublish && p.publishBlockers.length > 0;

  const run = (a: "publish" | "unpublish") =>
    action.mutate(a, {
      onSuccess: () => toast.success(a === "publish" ? `“${p.title}” is live in the store` : `“${p.title}” is hidden from the store`),
      onError: (err) => {
        const details = err instanceof ApiError ? err.details?.publish : undefined;
        toast.error(details?.length ? `${err.message}: ${details.join("; ")}` : errorMessage(err));
      },
    });

  return (
    <div className={cn("flex items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
      {canPublish &&
        (blocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled button can't show a tooltip, so the wrapper carries it. */}
              <span tabIndex={0}>
                <Button size="sm" disabled>
                  <Rocket /> Publish
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">Before publishing: {p.publishBlockers.join(" · ")}</TooltipContent>
          </Tooltip>
        ) : (
          <Button size="sm" onClick={() => run("publish")} disabled={action.isPending}>
            <Rocket /> Publish
          </Button>
        ))}
      {p.status === "published" && (
        <>
          <Button size="sm" variant="outline" onClick={() => run("unpublish")} disabled={action.isPending}>
            <EyeOff /> Unpublish
          </Button>
          <Button asChild size="icon-sm" variant="ghost" aria-label={`View “${p.title}” in the store`}>
            <Link href={`/ebooks/${p.slug}`} target="_blank">
              <ExternalLink />
            </Link>
          </Button>
        </>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        aria-label={`Delete “${p.title}”`}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 />
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{p.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The eBook, its PDF and cover are removed permanently. This cannot be undone. Books that someone has already
              bought can&apos;t be deleted — archive them instead so buyers keep access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(p.id, {
                  onSuccess: () => toast.success(`“${p.title}” deleted`),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
