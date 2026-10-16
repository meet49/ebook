"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/utils";

const SORTS = ["featured", "newest", "price_asc", "price_desc"] as const;

/** Filters live in the URL so results are shareable and server-rendered. */
export function CatalogFilters({ categories }: { categories: string[] }) {
  const t = useMessages().catalog;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const sortLabels: Record<(typeof SORTS)[number], string> = {
    featured: t.sort.featured,
    newest: t.sort.newest,
    price_asc: t.sort.priceAsc,
    price_desc: t.sort.priceDesc,
  };

  const activeCategory = params.get("category");
  const hasFilters = Boolean(params.get("q") || activeCategory || params.get("sort"));

  const pill = (active: boolean) =>
    cn(
      "focus-visible:ring-ring/50 inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3",
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-indigo-900/10"
        : "bg-background/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    );

  return (
    <div className="space-y-4">
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search.placeholder}
          className="bg-background h-12 rounded-full pr-28 pl-12 text-base shadow-sm sm:h-14 sm:text-base"
          aria-label={t.search.label}
        />
        <Button type="submit" className="absolute top-1/2 right-1.5 h-9 -translate-y-1/2 rounded-full px-5 sm:h-11">
          {t.search.submit}
        </Button>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {categories.length > 0 && (
          <div
            role="group"
            aria-label={t.categories}
            className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            <button type="button" aria-pressed={!activeCategory} className={pill(!activeCategory)} onClick={() => update({ category: null })}>
              {t.allCategories}
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={activeCategory === c}
                className={pill(activeCategory === c)}
                onClick={() => update({ category: activeCategory === c ? null : c })}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={params.get("sort") ?? "featured"} onValueChange={(v) => update({ sort: v === "featured" ? null : v })}>
            <SelectTrigger className="bg-background/70 h-9! min-w-44 rounded-full px-4" aria-label={t.sort.label}>
              <ArrowUpDown className="text-muted-foreground" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {sortLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pending ? (
            <span className="flex size-9 items-center justify-center" role="status" aria-label={t.updating}>
              <Spinner />
            </span>
          ) : hasFilters ? (
            <Button
              variant="ghost"
              className="text-muted-foreground h-9 rounded-full px-3"
              onClick={() => {
                setQ("");
                startTransition(() => router.push(pathname, { scroll: false }));
              }}
            >
              <X /> <span className="sr-only sm:not-sr-only">{t.clearFilters}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
