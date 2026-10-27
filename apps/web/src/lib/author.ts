"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminProduct, AuthorEarningDto, AuthorProfileDto, AuthorStats, Paginated } from "@ebook/shared";
import { ApiError, api } from "./api";
import { authorProductsKey } from "./admin-products";

export const authorProfileKey = ["author", "me"] as const;

/** The signed-in user's author profile, or null if they have not applied. */
export function useAuthorProfile(enabled = true) {
  return useQuery({
    queryKey: authorProfileKey,
    enabled,
    queryFn: async () => {
      try {
        return (await api<{ profile: AuthorProfileDto }>("/author/me")).profile;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
        throw err;
      }
    },
  });
}

export function useAuthorStats() {
  return useQuery({
    queryKey: ["author", "stats"],
    queryFn: () => api<{ stats: AuthorStats }>("/author/stats").then((r) => r.stats),
  });
}

export function useAuthorBooks() {
  return useQuery({
    queryKey: authorProductsKey,
    queryFn: () => api<Paginated<AdminProduct>>("/author/products").then((r) => r.items),
  });
}

export function useAuthorEarnings(page: number) {
  return useQuery({
    queryKey: ["author", "earnings", page],
    queryFn: () => api<Paginated<AuthorEarningDto>>(`/author/earnings?page=${page}`),
  });
}
