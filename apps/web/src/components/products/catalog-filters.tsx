"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const ALL = "__all";

/** Filters live in the URL so results are shareable and server-rendered. */
export function CatalogFilters({ categories }: { categories: string[] }) {
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

  const hasFilters = Boolean(params.get("q") || params.get("category") || params.get("sort"));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        role="search"
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q.trim() || null });
        }}
      >
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, author or topic"
          className="h-10 pl-9"
          aria-label="Search eBooks"
        />
      </form>
      <div className="flex gap-2">
        <Select value={params.get("category") ?? ALL} onValueChange={(v) => update({ category: v === ALL ? null : v })}>
          <SelectTrigger className="h-10 min-w-36" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get("sort") ?? "featured"} onValueChange={(v) => update({ sort: v === "featured" ? null : v })}>
          <SelectTrigger className="h-10 min-w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending ? (
          <span className="flex w-9 items-center justify-center">
            <Spinner />
          </span>
        ) : hasFilters ? (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Clear filters"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
          >
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
