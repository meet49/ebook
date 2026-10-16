"use client";

import { ChevronLeft, ChevronRight, Eye, FileUp, ImageUp, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { AdminProduct } from "@ebook/shared";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { PdfPageImage } from "@/components/products/sample-pages";
import { Skeleton } from "@/components/ui/skeleton";
import { adminPdfUrl, useProductAction, useSetProductCache } from "@/lib/admin-products";
import { usePdfDocument } from "@/lib/pdf-client";
import { errorMessage } from "@/lib/api";
import { uploadFile } from "@/lib/upload";

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="bg-primary h-full transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

function useUploader(productId: string, kind: "cover" | "pdf") {
  const setCache = useSetProductCache();
  const [progress, setProgress] = useState<number | null>(null);
  const upload = async (file: File) => {
    setProgress(0);
    try {
      const { product } = await uploadFile<{ product: AdminProduct }>(`/admin/products/${productId}/${kind}`, file, setProgress);
      setCache(product);
      toast.success(kind === "cover" ? "Cover updated" : "PDF uploaded — reading pages…");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
    }
  };
  return { progress, upload };
}

export function ProductFiles({ product }: { product: AdminProduct }) {
  const cover = useUploader(product.id, "cover");
  const pdf = useUploader(product.id, "pdf");
  const action = useProductAction(product.id);
  const coverInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState(false);
  const { processing } = product;
  const busy = processing.status === "queued" || processing.status === "processing";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cover</CardTitle>
          <CardDescription>JPG, PNG or WebP, ideally 1200 × 1800 px.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BookCover src={product.coverUrl} title={product.title} className="mx-auto w-40" sizes="160px" />
          {cover.progress !== null && <Progress value={cover.progress} />}
          <input
            ref={coverInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void cover.upload(file);
            }}
          />
          <Button variant="outline" className="w-full" disabled={cover.progress !== null} onClick={() => coverInput.current?.click()}>
            {cover.progress !== null ? <Spinner /> : <ImageUp />}
            {product.coverUrl ? "Replace cover" : "Upload cover"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>eBook PDF</CardTitle>
          <CardDescription>Stored privately. Each buyer gets a personal copy with their email watermarked on every page, readable only in the ReadnShare reader.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {product.pdf ? (
            <div className="bg-muted/50 rounded-lg border p-3 text-sm">
              <p className="truncate font-medium">{product.pdf.filename}</p>
              <p className="text-muted-foreground">
                {formatBytes(product.pdf.sizeBytes)}
                {product.pageCount ? ` · ${product.pageCount} pages` : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No PDF uploaded yet.</p>
          )}

          {pdf.progress !== null && (
            <div className="space-y-1">
              <p className="text-sm">Uploading… {pdf.progress}%</p>
              <Progress value={pdf.progress} />
            </div>
          )}

          {busy && (
            <div className="space-y-1" aria-live="polite">
              <p className="flex items-center gap-2 text-sm">
                <Spinner /> Reading the PDF (pages and chapters)…
              </p>
              <Progress value={processing.total ? Math.round((processing.done / processing.total) * 100) : 0} />
            </div>
          )}

          {processing.status === "failed" && (
            <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-3 text-sm" role="alert">
              <p className="text-destructive">{processing.error}</p>
              <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate("reprocess", { onError: (e) => toast.error(errorMessage(e)) })}>
                <RefreshCw /> Try again
              </Button>
            </div>
          )}

          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pdf.upload(file);
            }}
          />
          <div className="flex flex-col gap-2">
            <Button variant="outline" disabled={pdf.progress !== null || busy} onClick={() => pdfInput.current?.click()}>
              <FileUp /> {product.pdf ? "Replace PDF" : "Upload PDF"}
            </Button>
            {product.pageCount > 0 && (
              <Button variant="ghost" onClick={() => setViewer(true)}>
                <Eye /> Preview all pages
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {product.pageCount > 0 && <PageViewer product={product} open={viewer} onOpenChange={setViewer} />}
    </div>
  );
}

function PageViewer({ product, open, onOpenChange }: { product: AdminProduct; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [page, setPage] = useState(1);
  // Loaded only while the viewer is open.
  const { doc } = usePdfDocument(open ? adminPdfUrl(product.id, product.updatedAt) : null);
  const last = product.pageCount;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-full max-w-2xl gap-3 p-3 sm:p-4">
        <DialogTitle className="text-base">
          {product.title} — page {page} of {last}
        </DialogTitle>
        <DialogDescription className="sr-only">Admin preview of the eBook pages.</DialogDescription>
        <div className="relative mx-auto aspect-[1/1.414] max-h-[75vh] w-full overflow-hidden rounded-md border bg-white">
          {doc ? <PdfPageImage key={page} doc={doc} page={page} width={680} alt={`Page ${page}`} className="h-full w-full object-contain" /> : <Skeleton className="h-full w-full" />}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= last} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
