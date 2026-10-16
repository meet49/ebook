"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminProduct, Paginated, ProductInput, ProductStatus } from "@ebook/shared";
import { api } from "./api";

export const adminProductsKey = ["admin", "products"] as const;
const productKey = (id: string) => ["admin", "product", id] as const;

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
export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: productKey(id),
    queryFn: ({ signal }) => api<{ product: AdminProduct }>(`/admin/products/${id}`, { signal }).then((r) => r.product),
    refetchInterval: (q) => {
      const status = q.state.data?.processing.status;
      return status === "queued" || status === "processing" ? 1500 : false;
    },
  });
}

export function useSetProductCache() {
  const qc = useQueryClient();
  return (product: AdminProduct) => {
    qc.setQueryData(productKey(product.id), product);
    void qc.invalidateQueries({ queryKey: adminProductsKey });
  };
}

export function useCreateProduct() {
  const setCache = useSetProductCache();
  return useMutation({
    mutationFn: (input: ProductInput) => api<{ product: AdminProduct }>("/admin/products", { method: "POST", body: input }),
    onSuccess: ({ product }) => setCache(product),
  });
}

export function useUpdateProduct(id: string) {
  const setCache = useSetProductCache();
  return useMutation({
    mutationFn: (input: ProductInput) => api<{ product: AdminProduct }>(`/admin/products/${id}`, { method: "PUT", body: input }),
    onSuccess: ({ product }) => setCache(product),
  });
}

export type ProductAction = "publish" | "unpublish" | "archive" | "restore" | "reprocess";

export function useProductAction(id: string) {
  const setCache = useSetProductCache();
  return useMutation({
    mutationFn: (action: ProductAction) => api<{ product: AdminProduct }>(`/admin/products/${id}/${action}`, { method: "POST" }),
    onSuccess: ({ product }) => setCache(product),
  });
}

export const adminPdfUrl = (id: string, version: string) => `/api/v1/admin/products/${id}/pdf?v=${encodeURIComponent(version)}`;
