"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminProduct, Paginated, ProductInput, ProductStatus } from "@ebook/shared";
import { api } from "./api";

/** Where a book editor's API lives: the admin's, or an author's own books. */
export type ProductsBase = "/admin/products" | "/author/products";

export const adminProductsKey = ["admin", "products"] as const;
export const authorProductsKey = ["author", "products"] as const;
const listKey = (base: ProductsBase) => (base === "/admin/products" ? adminProductsKey : authorProductsKey);
const productKey = (base: ProductsBase, id: string) => [base, "product", id] as const;

export function useAdminProducts(params: { q?: string; status?: ProductStatus; page: number }) {
  const search = new URLSearchParams({ page: String(params.page), pageSize: "20" });
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  return useQuery({
    queryKey: [...adminProductsKey, params],
    queryFn: ({ signal }) => api<Paginated<AdminProduct>>(`/admin/products?${search}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Polls while the PDF is being processed so progress updates live. */
export function useAdminProduct(id: string, base: ProductsBase = "/admin/products") {
  return useQuery({
    queryKey: productKey(base, id),
    queryFn: ({ signal }) => api<{ product: AdminProduct }>(`${base}/${id}`, { signal }).then((r) => r.product),
    refetchInterval: (q) => {
      const status = q.state.data?.processing.status;
      return status === "queued" || status === "processing" ? 1500 : false;
    },
  });
}

export function useSetProductCache(base: ProductsBase = "/admin/products") {
  const qc = useQueryClient();
  return (product: AdminProduct) => {
    qc.setQueryData(productKey(base, product.id), product);
    void qc.invalidateQueries({ queryKey: listKey(base) });
  };
}

export function useCreateProduct(base: ProductsBase = "/admin/products") {
  const setCache = useSetProductCache(base);
  return useMutation({
    mutationFn: (input: ProductInput) => api<{ product: AdminProduct }>(base, { method: "POST", body: input }),
    onSuccess: ({ product }) => setCache(product),
  });
}

export function useUpdateProduct(id: string, base: ProductsBase = "/admin/products") {
  const setCache = useSetProductCache(base);
  return useMutation({
    mutationFn: (input: ProductInput) => api<{ product: AdminProduct }>(`${base}/${id}`, { method: "PUT", body: input }),
    onSuccess: ({ product }) => setCache(product),
  });
}

/** Admin actions, plus an author's submit / withdraw. */
export type ProductAction = "publish" | "unpublish" | "archive" | "restore" | "reprocess" | "submit" | "withdraw";

export function useProductAction(id: string, base: ProductsBase = "/admin/products") {
  const setCache = useSetProductCache(base);
  return useMutation({
    mutationFn: (action: ProductAction) => api<{ product: AdminProduct }>(`${base}/${id}/${action}`, { method: "POST" }),
    onSuccess: ({ product }) => setCache(product),
  });
}

/** Sends an author's book back from review with a note. */
export function useRequestChanges(id: string) {
  const setCache = useSetProductCache();
  return useMutation({
    mutationFn: (note: string) => api<{ product: AdminProduct }>(`/admin/products/${id}/request-changes`, { method: "POST", body: { note } }),
    onSuccess: ({ product }) => setCache(product),
  });
}

export const adminPdfUrl = (id: string, version: string, base: ProductsBase = "/admin/products") =>
  `/api/v1${base}/${id}/pdf?v=${encodeURIComponent(version)}`;

/** Permanently deletes an unsold eBook (the API refuses books that were bought). */
export function useDeleteProduct(base: ProductsBase = "/admin/products") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: productKey(base, id) });
      void qc.invalidateQueries({ queryKey: listKey(base) });
    },
  });
}
