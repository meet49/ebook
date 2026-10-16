"use client";

import Link from "next/link";
import { PageFlip } from "page-flip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  List,
  Maximize,
  Minimize,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage } from "@/lib/api";
import { renderPageUrl } from "@/lib/pdf-client";
import { saveProgress, useBookmarkMutations, type ReaderManifest } from "@/lib/reader";
import { cn } from "@/lib/utils";

/** How many pages around the current one are drawn ahead of time. */
const PRELOAD_BEHIND = 2;
const PRELOAD_AHEAD = 4;
/** Pages are drawn at this CSS width (times the screen's pixel ratio, max 2x). */
const RENDER_CSS_WIDTH = 900;

function readPref(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* storage unavailable (private mode) — preference just isn't remembered */
  }
}

export function BookReader({ manifest, startPage, doc }: { manifest: ReaderManifest; startPage: number; doc: PDFDocumentProxy }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);
  // Captured once: later manifest updates (e.g. bookmarks) must not rebuild the book.
  const startPageRef = useRef(startPage);

  const [page, setPage] = useState(startPage);
  const [spread, setSpread] = useState(false);
  const [dark, setDark] = useState(() => readPref("reader:dark"));
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<"contents" | "bookmarks" | null>(null);
  const { add, remove } = useBookmarkMutations(manifest.slug, manifest.productId);
  const total = manifest.pageCount;

  // Pages are drawn from the PDF in the browser, one at a time, only near the current page.
  // Pages far behind are released again so long books stay light on phones.
  const renderQueue = useRef<Promise<void>>(Promise.resolve());
  const rendered = useRef(new Map<number, string>());
  const preload = useCallback(
    (current: number) => {
      const want = new Set<number>();
      for (let n = Math.max(1, current - PRELOAD_BEHIND); n <= Math.min(total, current + PRELOAD_AHEAD); n++) want.add(n);
      for (const [n, url] of rendered.current) {
        if (n < current - PRELOAD_BEHIND * 3 || n > current + PRELOAD_AHEAD * 3) {
          URL.revokeObjectURL(url);
          rendered.current.delete(n);
          imagesRef.current[n - 1]?.removeAttribute("src");
        }
      }
      // Current page first, then the ones ahead, then behind.
      const order = [...want].sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || b - a);
      for (const n of order) {
        if (rendered.current.has(n)) continue;
        rendered.current.set(n, "");
        renderQueue.current = renderQueue.current.then(async () => {
          try {
            const url = await renderPageUrl(doc, n, RENDER_CSS_WIDTH);
            if (!rendered.current.has(n)) return URL.revokeObjectURL(url);
            rendered.current.set(n, url);
            const img = imagesRef.current[n - 1];
            if (img) img.src = url;
          } catch {
            rendered.current.delete(n);
            if (!warnedRef.current) {
              warnedRef.current = true;
              toast.error("A page could not be displayed. Try reopening the book.");
            }
          }
        });
      }
    },
    [doc, total],
  );

  useEffect(
    () => () => {
      for (const url of rendered.current.values()) if (url) URL.revokeObjectURL(url);
      rendered.current.clear();
    },
    [],
  );

  useEffect(() => {
    const wrapper = bookRef.current;
    if (!wrapper) return;
    // page-flip removes its container element when destroyed, so build a fresh one each time
    // (React re-runs this effect in development and whenever the book is re-initialised).
    const host = document.createElement("div");
    host.className = "reader-book";
    wrapper.replaceChildren(host);
    // Fresh page elements: forget pages drawn for a previous build.
    for (const url of rendered.current.values()) if (url) URL.revokeObjectURL(url);
    rendered.current.clear();

    // page-flip moves these nodes around itself, so they are created outside React's tree.
    const pages: HTMLElement[] = [];
    imagesRef.current = [];
    for (let n = 1; n <= total; n++) {
      const el = document.createElement("div");
      el.className = "reader-page";
      if (n === 1 || n === total) el.dataset.density = "hard";
      const img = document.createElement("img");
      img.alt = `Page ${n}`;
      img.draggable = false;
      img.decoding = "async";
      el.appendChild(img);
      pages.push(el);
      imagesRef.current.push(img);
    }
    host.replaceChildren(...pages);

    // Fit a whole page inside the visible area: the height limit decides, width follows the page ratio.
    const ratio = manifest.pageWidth / manifest.pageHeight;
    const maxHeight = Math.max(300, Math.floor(wrapper.clientHeight || window.innerHeight - 140));
    const maxWidth = Math.max(200, Math.floor(maxHeight * ratio));
    const width = Math.min(560, maxWidth);
    const flip = new PageFlip(host, {
      width,
      height: Math.round(width / ratio),
      size: "stretch",
      minWidth: 200,
      maxWidth,
      minHeight: 280,
      maxHeight,
      startPage: Math.max(0, startPageRef.current - 1),
      showCover: true,
      usePortrait: true,
      mobileScrollSupport: false,
      maxShadowOpacity: 0.35,
      flippingTime: 650,
      drawShadow: true,
      autoSize: true,
    });
    flip.loadFromHTML(pages);
    flipRef.current = flip;
    setSpread(flip.getOrientation() === "landscape");
    preload(startPageRef.current);

    flip.on("flip", (e) => {
      const current = e.data + 1;
      setPage(current);
      setSpread(flip.getOrientation() === "landscape");
      preload(current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveProgress(manifest.productId, current).catch(() => {}), 800);
    });
    flip.on("changeOrientation", (e) => setSpread(e.data === "landscape"));

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flipRef.current = null;
      try {
        flip.destroy();
      } catch {
        /* already torn down */
      }
      try {
        host.remove();
      } catch {
        /* already torn down */
      }
    };
  }, [manifest.productId, manifest.pageWidth, manifest.pageHeight, total, preload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") flipRef.current?.flipNext();
      if (e.key === "ArrowLeft") flipRef.current?.flipPrev();
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const goTo = (n: number) => {
    const target = Math.min(total, Math.max(1, n));
    flipRef.current?.turnToPage(target - 1);
    setPage(target);
    preload(target);
    void saveProgress(manifest.productId, target).catch(() => {});
    setPanel(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapperRef.current?.requestFullscreen();
    } catch {
      toast.error("Full screen isn't available in this browser.");
    }
  };

  const toggleDark = () => {
    setDark((d) => {
      writePref("reader:dark", !d);
      return !d;
    });
  };

  // In two-page view the visible pair is [page, page + 1] (the cover sits alone).
  const visible = spread && page > 1 && page < total ? [page, page + 1] : [page];
  const bookmark = manifest.bookmarks.find((b) => visible.includes(b.page));
  const pageLabel = visible.length === 2 ? `Pages ${visible[0]}–${visible[1]}` : `Page ${page}`;

  return (
    <div
      ref={wrapperRef}
      className={cn("reader-root flex h-dvh flex-col select-none", dark ? "reader-dark bg-neutral-950 text-neutral-100" : "bg-neutral-100 text-neutral-900")}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className={cn("flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4", dark ? "border-white/10" : "border-black/5 bg-white/70")}>
        <Button asChild variant="ghost" size="icon-lg" aria-label="Back to library">
          <Link href="/library">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{manifest.title}</p>
          <p className="truncate text-xs opacity-60">{manifest.author}</p>
        </div>
        <ToolbarButton label="Contents and bookmarks" onClick={() => setPanel("contents")}>
          <List />
        </ToolbarButton>
        <ToolbarButton
          label={bookmark ? "Remove bookmark" : "Bookmark this page"}
          onClick={() =>
            bookmark
              ? remove.mutate(bookmark.id, { onError: (e) => toast.error(errorMessage(e)) })
              : add.mutate({ page: visible[0]!, label: "" }, { onSuccess: () => toast.success(`Bookmarked page ${visible[0]}`), onError: (e) => toast.error(errorMessage(e)) })
          }
        >
          {bookmark ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
        </ToolbarButton>
        <ToolbarButton label={dark ? "Light mode" : "Dark mode"} onClick={toggleDark}>
          {dark ? <Sun /> : <Moon />}
        </ToolbarButton>
        <ToolbarButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </ToolbarButton>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-3 sm:px-12 sm:py-6">
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={page <= 1}
          className="absolute top-1/2 left-1 z-10 hidden -translate-y-1/2 rounded-full p-2 opacity-60 transition hover:opacity-100 disabled:opacity-20 sm:block"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-7" />
        </button>
        <div className="flex h-full w-full max-w-300 items-center justify-center">
          <div ref={bookRef} data-reader-book className="flex h-full w-full items-center justify-center" />
        </div>
        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={page >= total}
          className="absolute top-1/2 right-1 z-10 hidden -translate-y-1/2 rounded-full p-2 opacity-60 transition hover:opacity-100 disabled:opacity-20 sm:block"
          aria-label="Next page"
        >
          <ChevronRight className="size-7" />
        </button>
      </main>

      <footer className={cn("flex shrink-0 items-center gap-3 border-t px-3 py-2 sm:px-6", dark ? "border-white/10" : "border-black/5 bg-white/70")}>
        <Button variant="ghost" size="icon-lg" onClick={() => flipRef.current?.flipPrev()} disabled={page <= 1} aria-label="Previous page" className="sm:hidden">
          <ChevronLeft />
        </Button>
        <input
          type="range"
          min={1}
          max={total}
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
          onPointerUp={(e) => goTo(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => (e.key === "Enter" || e.key.startsWith("Arrow")) && goTo(Number((e.target as HTMLInputElement).value))}
          className="accent-primary h-1.5 flex-1 cursor-pointer"
          aria-label="Go to page"
        />
        <span className="min-w-28 text-right text-xs tabular-nums opacity-70" aria-live="polite">
          {pageLabel} of {total} · {Math.round((page / total) * 100)}%
        </span>
        <Button variant="ghost" size="icon-lg" onClick={() => flipRef.current?.flipNext()} disabled={page >= total} aria-label="Next page" className="sm:hidden">
          <ChevronRight />
        </Button>
      </footer>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{manifest.title}</SheetTitle>
            <SheetDescription>Jump to a chapter or bookmark.</SheetDescription>
          </SheetHeader>
          <Tabs value={panel ?? "contents"} onValueChange={(v) => setPanel(v as "contents" | "bookmarks")} className="px-3">
            <TabsList className="w-full">
              <TabsTrigger value="contents">Contents</TabsTrigger>
              <TabsTrigger value="bookmarks">Bookmarks ({manifest.bookmarks.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="contents" className="max-h-[calc(100dvh-170px)] overflow-y-auto">
              {manifest.toc.length ? (
                <ul className="py-2">
                  {manifest.toc.map((t, i) => (
                    <li key={`${t.page}-${i}`}>
                      <button
                        type="button"
                        onClick={() => goTo(t.page)}
                        className={cn("hover:bg-muted flex w-full justify-between gap-3 rounded-md px-2 py-2 text-left text-sm", t.title.startsWith("— ") && "pl-5 opacity-80")}
                      >
                        <span>{t.title}</span>
                        <span className="text-muted-foreground tabular-nums">{t.page}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <GoToPage total={total} onGo={goTo} />
              )}
            </TabsContent>
            <TabsContent value="bookmarks" className="max-h-[calc(100dvh-170px)] overflow-y-auto">
              {manifest.bookmarks.length ? (
                <ul className="py-2">
                  {manifest.bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => goTo(b.page)} className="hover:bg-muted flex-1 rounded-md px-2 py-2 text-left text-sm">
                        Page {b.page}
                        {b.label ? <span className="text-muted-foreground"> · {b.label}</span> : null}
                      </button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove bookmark on page ${b.page}`} onClick={() => remove.mutate(b.id)}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-2 py-6 text-sm">No bookmarks yet. Use the bookmark button in the top bar to save a page.</p>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-lg" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function GoToPage({ total, onGo }: { total: number; onGo: (n: number) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2 px-2 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (Number.isInteger(n) && n >= 1 && n <= total) onGo(n);
      }}
    >
      <input
        type="number"
        min={1}
        max={total}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Page 1–${total}`}
        className="border-input bg-background h-9 flex-1 rounded-lg border px-3 text-sm"
        aria-label="Page number"
      />
      <Button type="submit" size="sm">
        Go
      </Button>
    </form>
  );
}
