"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
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
  const t = useMessages().product.sample;
  const { doc, error } = usePdfDocument(sample.url);
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : sample.pages[index];

  if (error) return <p className="text-muted-foreground bg-muted/50 rounded-2xl border border-dashed p-4 text-sm">{t.error}</p>;

  return (
    <>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:px-0" onContextMenu={(e) => e.preventDefault()}>
        {sample.pages.map((page, i) => (
          <button
            key={page}
            type="button"
            onClick={() => setIndex(i)}
            disabled={!doc}
            // Paper stays white in dark mode: these are real PDF pages.
            className="group focus-visible:ring-ring/50 relative aspect-[1/1.414] w-32 shrink-0 snap-start overflow-hidden rounded-xl border bg-white shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/10 focus-visible:ring-3 sm:w-36"
            aria-label={t.open(page)}
          >
            {doc ? (
              <PdfPageImage doc={doc} page={i + 1} width={150} alt="" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
            <span className="bg-background/90 text-foreground absolute bottom-1.5 left-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur">
              {t.pageShort(page)}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={current != null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="max-h-[95vh] w-full max-w-2xl gap-3 rounded-2xl p-3 sm:p-4" onContextMenu={(e) => e.preventDefault()}>
          <DialogTitle className="pr-8 text-base">{current != null ? t.dialogTitle(title, current) : title}</DialogTitle>
          <DialogDescription className="sr-only">{t.dialogDescription}</DialogDescription>
          {doc && index !== null && current != null && (
            <div className="mx-auto aspect-[1/1.414] max-h-[75vh] w-full overflow-hidden rounded-lg border bg-white">
              <PdfPageImage key={index} doc={doc} page={index + 1} width={680} alt={t.pageAlt(current)} className="h-full w-full object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="rounded-full" disabled={!index} onClick={() => setIndex((i) => (i ?? 0) - 1)}>
              <ChevronLeft /> {t.previous}
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              {(index ?? 0) + 1} / {sample.pages.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={index === null || index >= sample.pages.length - 1}
              onClick={() => setIndex((i) => (i ?? 0) + 1)}
            >
              {t.next} <ChevronRight />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { PdfPageImage };
