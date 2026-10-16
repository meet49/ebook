"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProductSummary, TocEntry } from "@ebook/shared";
import { api } from "./api";

export interface ReaderManifest {
  productId: string;
  slug: string;
  title: string;
  author: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  toc: TocEntry[];
  coverUrl: string | null;
  /** The buyer's personal watermarked PDF; fetch it with the reader header. */
  bookUrl: string;
  readerHeader: string;
  progress: { page: number; percent: number };
  bookmarks: { id: string; page: number; label: string }[];
}

export interface LibraryItem {
  productId: string;
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
  pageCount: number;
  readable: boolean;
  purchasedAt: string;
  progress: { page: number; percent: number; lastOpenedAt: string } | null;
}

export interface BookmarkItem {
  id: string;
  productId: string;
  slug: string;
  title: string;
  page: number;
  label: string;
  createdAt: string;
}

const manifestKey = (slug: string) => ["reader", slug] as const;

export function useManifest(slug: string) {
  return useQuery({
    queryKey: manifestKey(slug),
    queryFn: () => api<ReaderManifest>(`/reader/by-slug/${encodeURIComponent(slug)}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useLibrary() {
  return useQuery({
    queryKey: ["me", "library"],
    queryFn: () => api<{ items: LibraryItem[]; explore: ProductSummary[] }>("/me/library"),
  });
}

export function useBookmarks() {
  return useQuery({
    queryKey: ["me", "bookmarks"],
    queryFn: () => api<{ items: BookmarkItem[] }>("/me/bookmarks").then((r) => r.items),
  });
}

export function useBookmarkMutations(slug: string, productId: string) {
  const qc = useQueryClient();
  const sync = (updater: (b: ReaderManifest["bookmarks"]) => ReaderManifest["bookmarks"]) => {
    qc.setQueryData<ReaderManifest>(manifestKey(slug), (m) => (m ? { ...m, bookmarks: updater(m.bookmarks) } : m));
    void qc.invalidateQueries({ queryKey: ["me", "bookmarks"] });
  };
  const add = useMutation({
    mutationFn: (input: { page: number; label: string }) =>
      api<{ bookmark: { id: string; page: number; label: string } }>("/me/bookmarks", { method: "POST", body: { productId, ...input } }),
    onSuccess: ({ bookmark }) => sync((list) => [...list.filter((b) => b.page !== bookmark.page), bookmark].sort((a, b) => a.page - b.page)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/me/bookmarks/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => sync((list) => list.filter((b) => b.id !== id)),
  });
  return { add, remove };
}

export function saveProgress(productId: string, page: number) {
  return api(`/me/progress/${productId}`, { method: "PUT", body: { page } });
}
