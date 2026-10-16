"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

let lib: Promise<typeof import("pdfjs-dist")> | null = null;

/** pdf.js is loaded only in the browser, on first use (its worker and fonts live in /public/pdfjs). */
function pdfjs() {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return m;
  });
  return lib;
}

export interface OpenPdf {
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}

export async function openPdf(data: ArrayBuffer): Promise<OpenPdf> {
  const m = await pdfjs();
  const task = m.getDocument({
    data,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
  });
  return { doc: await task.promise, close: () => task.destroy() };
}

/** Renders one page (1-based) to an object URL at the given CSS width, sharp on high-DPI screens. */
export async function renderPageUrl(doc: PDFDocumentProxy, pageNumber: number, cssWidth: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth * pixelRatio) / page.getViewport({ scale: 1 }).width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("Could not render page");
  return URL.createObjectURL(blob);
}

export class PdfFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fetches a PDF (same-origin, with the session cookie) and opens it. Cleans up on unmount. */
export function usePdfDocument(url: string | null, headers?: Record<string, string>) {
  const [state, setState] = useState<{ doc: PDFDocumentProxy | null; error: Error | null; loading: boolean }>({
    doc: null,
    error: null,
    loading: Boolean(url),
  });
  const headerKey = JSON.stringify(headers ?? {});

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let opened: OpenPdf | null = null;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { credentials: "same-origin", headers: JSON.parse(headerKey), signal: controller.signal });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new PdfFetchError(res.status, body?.error?.message ?? "Could not load this book");
        }
        opened = await openPdf(await res.arrayBuffer());
        if (cancelled) return void opened.close();
        setState({ doc: opened.doc, error: null, loading: false });
      } catch (err) {
        if (!cancelled) setState({ doc: null, error: err as Error, loading: false });
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      void opened?.close();
    };
  }, [url, headerKey]);

  return state;
}
