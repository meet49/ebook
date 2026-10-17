"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, Portal, PublicUser, RegisterInput, Role } from "@ebook/shared";
import { ApiError, api } from "./api";

export const meQueryKey = ["auth", "me"] as const;

/** The signed-in user, or null for visitors. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        const { user } = await api<{ user: PublicUser }>("/auth/me");
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    // Email links (verify, magic sign-in) usually open in the browser or an email app, not in the
    // installed app or this tab. Re-check when the user comes back so the change shows at once.
    refetchOnWindowFocus: "always",
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

export function hasRole(user: PublicUser | null | undefined, role: Role): boolean {
  return Boolean(user?.roles.includes(role));
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: PublicUser }>("/auth/login", { method: "POST", body: input }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api<{ user: PublicUser }>("/auth/register", { method: "POST", body: input }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(meQueryKey, null);
    },
  });
}

export const PORTAL_HOME: Record<Portal, string> = {
  customer: "/library",
  affiliate: "/affiliate",
  admin: "/admin",
};

export const PORTAL_LOGIN: Record<Portal, string> = {
  customer: "/login",
  affiliate: "/affiliate/login",
  admin: "/admin/login",
};

/** Only same-site relative paths may be used as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || next.length > 300 || !next.startsWith("/")) return fallback;
  // Reject control characters and backslashes (browsers normalise "/\t/x" and "/\x" to "//x").
  if (/[\u0000- \\]/.test(next) || /^\/(\/|%2f|%5c)/i.test(next)) return fallback;
  try {
    // A fixed placeholder origin keeps this safe during server rendering, where window is absent.
    const base = "https://app.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
