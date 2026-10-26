"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Skeleton } from "@/components/ui/skeleton";
import { renderPageUrl } from "@/lib/pdf-client";

/** One page of a PDF drawn to an image; shows a skeleton until ready. */
export function PdfPageImage({ doc, page, width, alt, className }: { doc: PDFDocumentProxy; page: number; width: number; alt: string; className?: string }) {
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
