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
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMessages } from "@/i18n/client";
import { errorMessage } from "@/lib/api";
import { renderPageUrl } from "@/lib/pdf-client";
import { saveProgress, useBookmarkMutations, type ReaderManifest } from "@/lib/reader";
import { cn } from "@/lib/utils";

/** How many pages around the current one are drawn ahead of time. */
const PRELOAD_BEHIND = 2;
const PRELOAD_AHEAD = 4;
/** Pages are drawn at this CSS width (times the screen's pixel ratio, max 2x). */
const RENDER_CSS_WIDTH = 900;

/** Ghost buttons on the reader's own light/dark surface: tint with the current text colour. */
const READER_BUTTON = "hover:bg-current/10 hover:text-inherit dark:hover:bg-current/10";

/** Site theme is the default until the reader picks a mode of its own. */
function siteIsDark(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function readPref(key: string, fallback: () => boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback() : value === "1";
  } catch {
    return fallback();
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
  const t = useMessages().reader;
  // Strings used inside the page-building effect and render queue, read without making them dependencies.
  const textRef = useRef(t);

  const [page, setPage] = useState(startPage);
  const [spread, setSpread] = useState(false);
  const [dark, setDark] = useState(() => readPref("reader:dark", siteIsDark));
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
              toast.error(textRef.current.pageError);
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
      img.alt = textRef.current.page(n);
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
      toast.error(t.fullscreenUnavailable);
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
  const pageLabel = visible.length === 2 ? t.pages(visible[0]!, visible[1]!) : t.page(page);
  const percent = Math.round((page / total) * 100);

  return (
    <div
      ref={wrapperRef}
      className={cn("reader-root flex h-dvh flex-col select-none", dark ? "reader-dark bg-neutral-950 text-neutral-100" : "bg-neutral-100 text-neutral-900")}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header
        className={cn(
          "relative z-20 flex h-14 shrink-0 items-center gap-1 border-b px-2 backdrop-blur-md sm:gap-2 sm:px-4",
          dark ? "border-white/10 bg-neutral-900/80" : "border-black/5 bg-white/80",
        )}
      >
        <Button asChild variant="ghost" size="icon-lg" aria-label={t.back} className={READER_BUTTON}>
          <Link href="/library">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm leading-tight font-semibold">{manifest.title}</p>
          <p className="truncate text-xs opacity-60">{manifest.author}</p>
        </div>
        <ToolbarButton label={t.contents} onClick={() => setPanel("contents")}>
          <List />
        </ToolbarButton>
        <ToolbarButton
          label={bookmark ? t.removeBookmark : t.addBookmark}
          onClick={() =>
            bookmark
              ? remove.mutate(bookmark.id, { onError: (e) => toast.error(errorMessage(e)) })
              : add.mutate({ page: visible[0]!, label: "" }, { onSuccess: () => toast.success(t.bookmarked(visible[0]!)), onError: (e) => toast.error(errorMessage(e)) })
          }
        >
          {bookmark ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
        </ToolbarButton>
        <ToolbarButton label={dark ? t.lightMode : t.darkMode} onClick={toggleDark}>
          {dark ? <Sun /> : <Moon />}
        </ToolbarButton>
        <ToolbarButton label={fullscreen ? t.exitFullscreen : t.fullscreen} onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </ToolbarButton>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-3 sm:px-12 sm:py-6">
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={page <= 1}
          className={cn(
            "absolute top-1/2 left-2 z-10 hidden -translate-y-1/2 rounded-full p-2 opacity-60 shadow-sm ring-1 transition hover:opacity-100 disabled:pointer-events-none disabled:opacity-20 sm:block",
            dark ? "bg-white/5 ring-white/10" : "bg-white/70 ring-black/5",
          )}
          aria-label={t.previous}
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="flex h-full w-full max-w-300 items-center justify-center">
          <div ref={bookRef} data-reader-book className="flex h-full w-full items-center justify-center" />
        </div>
        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={page >= total}
          className={cn(
            "absolute top-1/2 right-2 z-10 hidden -translate-y-1/2 rounded-full p-2 opacity-60 shadow-sm ring-1 transition hover:opacity-100 disabled:pointer-events-none disabled:opacity-20 sm:block",
            dark ? "bg-white/5 ring-white/10" : "bg-white/70 ring-black/5",
          )}
          aria-label={t.next}
        >
          <ChevronRight className="size-6" />
        </button>
      </main>

      <footer
        className={cn(
          "flex shrink-0 items-center gap-2 border-t px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:gap-4 sm:px-6",
          dark ? "border-white/10 bg-neutral-900/80" : "border-black/5 bg-white/80",
        )}
      >
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={page <= 1}
          aria-label={t.previous}
          className={cn("sm:hidden", READER_BUTTON)}
        >
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
          className="accent-primary h-1.5 min-w-0 flex-1 cursor-pointer"
          aria-label={t.goToPage}
          aria-valuetext={t.position(pageLabel, total, percent)}
        />
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-right text-xs font-medium tabular-nums",
            dark ? "bg-white/10 text-neutral-200" : "bg-black/5 text-neutral-700",
          )}
          aria-live="polite"
        >
          {t.position(pageLabel, total, percent)}
        </span>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => flipRef.current?.flipNext()}
          disabled={page >= total}
          aria-label={t.next}
          className={cn("sm:hidden", READER_BUTTON)}
        >
          <ChevronRight />
        </Button>
      </footer>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>{manifest.title}</SheetTitle>
            <SheetDescription>{t.panelDescription}</SheetDescription>
            <p className="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
              <ShieldCheck className="text-success size-3.5 shrink-0" aria-hidden />
              {t.personalCopy}
            </p>
          </SheetHeader>
          <Tabs value={panel ?? "contents"} onValueChange={(v) => setPanel(v as "contents" | "bookmarks")} className="px-3">
            <TabsList className="w-full">
              <TabsTrigger value="contents">{t.tabContents}</TabsTrigger>
              <TabsTrigger value="bookmarks">{t.tabBookmarks(manifest.bookmarks.length)}</TabsTrigger>
            </TabsList>
            <TabsContent value="contents" className="max-h-[calc(100dvh-190px)] overflow-y-auto">
              {manifest.toc.length ? (
                <ul className="py-2">
                  {manifest.toc.map((entry, i) => (
                    <li key={`${entry.page}-${i}`}>
                      <button
                        type="button"
                        onClick={() => goTo(entry.page)}
                        className={cn(
                          "hover:bg-muted flex w-full justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                          entry.title.startsWith("— ") && "pl-5 opacity-80",
                        )}
                      >
                        <span>{entry.title}</span>
                        <span className="text-muted-foreground tabular-nums">{entry.page}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <GoToPage total={total} onGo={goTo} />
              )}
            </TabsContent>
            <TabsContent value="bookmarks" className="max-h-[calc(100dvh-190px)] overflow-y-auto">
              {manifest.bookmarks.length ? (
                <ul className="py-2">
                  {manifest.bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => goTo(b.page)}
                        className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors"
                      >
                        <span className="bg-accent text-accent-foreground shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                          {t.page(b.page)}
                        </span>
                        {b.label ? <span className="text-muted-foreground truncate">{b.label}</span> : null}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t.removeBookmarkOn(b.page)}
                        onClick={() => remove.mutate(b.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-2 py-6 text-sm leading-relaxed">{t.noBookmarks}</p>
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
        <Button variant="ghost" size="icon-lg" onClick={onClick} aria-label={label} className={READER_BUTTON}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function GoToPage({ total, onGo }: { total: number; onGo: (n: number) => void }) {
  const t = useMessages().reader;
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
        placeholder={t.pageRange(total)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px]"
        aria-label={t.pageNumber}
      />
      <Button type="submit" size="sm" className="h-9">
        {t.go}
      </Button>
    </form>
  );
}
