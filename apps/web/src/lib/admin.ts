"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paginated, PublicUser, Role, UserStatus } from "@ebook/shared";
import { api } from "./api";

export function useAdminUsers(params: { q?: string; role?: Role; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.role) search.set("role", params.role);
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", String(params.pageSize ?? 20));

  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: ({ signal }) => api<Paginated<PublicUser>>(`/admin/users?${search}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api<{ user: PublicUser }>(`/admin/users/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
