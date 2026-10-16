"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { renderPageUrl, usePdfDocument } from "@/lib/pdf-client";

/** One page of a PDF drawn to an image; shows a skeleton until ready. */
function PdfPageImage({ doc, page, width, alt, className }: { doc: PDFDocumentProxy; page: number; width: number; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    let cancelled = false;
    renderPageUrl(doc, page, width)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else setUrl((current = u));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [doc, page, width]);
  if (!url) return <Skeleton className="h-full w-full rounded-none" />;
  // eslint-disable-next-line @next/next/no-img-element -- local object URL rendered from the PDF
  return <img src={url} alt={alt} draggable={false} className={className} />;
}

/** Public sample pages from the sample PDF (only the pages the admin chose). */
export function SamplePages({ title, sample }: { title: string; sample: { url: string; pages: number[] } }) {
  const { doc, error } = usePdfDocument(sample.url);
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : sample.pages[index];

  if (error) return <p className="text-muted-foreground text-sm">The sample could not be loaded.</p>;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2" onContextMenu={(e) => e.preventDefault()}>
        {sample.pages.map((page, i) => (
          <button
            key={page}
            type="button"
            onClick={() => setIndex(i)}
            disabled={!doc}
            className="group focus-visible:ring-ring/50 relative aspect-[1/1.414] w-32 shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm outline-none focus-visible:ring-3 sm:w-36"
            aria-label={`Open sample page ${page}`}
          >
            {doc ? (
              <PdfPageImage doc={doc} page={i + 1} width={150} alt="" className="h-full w-full object-cover object-top transition-transform group-hover:scale-105" />
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
            <span className="bg-background/90 absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium">p. {page}</span>
          </button>
        ))}
      </div>

      <Dialog open={current != null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="max-h-[95vh] w-full max-w-2xl gap-3 p-3 sm:p-4" onContextMenu={(e) => e.preventDefault()}>
          <DialogTitle className="text-base">
            {title} — sample page {current}
          </DialogTitle>
          <DialogDescription className="sr-only">Preview of a sample page from this eBook.</DialogDescription>
          {doc && index !== null && (
            <div className="mx-auto aspect-[1/1.414] max-h-[75vh] w-full overflow-hidden rounded-md border bg-white">
              <PdfPageImage key={index} doc={doc} page={index + 1} width={680} alt={`Sample page ${current}`} className="h-full w-full object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={!index} onClick={() => setIndex((i) => (i ?? 0) - 1)}>
              <ChevronLeft /> Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              {(index ?? 0) + 1} / {sample.pages.length}
            </span>
            <Button variant="outline" size="sm" disabled={index === null || index >= sample.pages.length - 1} onClick={() => setIndex((i) => (i ?? 0) + 1)}>
              Next <ChevronRight />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { PdfPageImage };
