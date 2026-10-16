"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PublicUser } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { meQueryKey, safeNext } from "@/lib/auth";

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: () => api("/auth/verify-email", { method: "POST", body: { token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: meQueryKey }),
  });
  const started = useRef(false);

  // Verification only confirms address ownership, so it is safe to run on page load.
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate();
    }
  }, [token, verify]);

  if (!token || verify.isError) {
    return (
      <div className="space-y-4 text-center">
        <XCircle className="text-destructive mx-auto size-10" aria-hidden />
        <p className="text-sm">{verify.error?.message ?? "This verification link is incomplete."}</p>
        <p className="text-muted-foreground text-sm">Sign in and request a new link from your account settings.</p>
        <Button asChild className="w-full">
          <Link href="/account">Go to account settings</Link>
        </Button>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <p className="text-sm">Your email address is verified. Thank you!</p>
        <Button asChild className="w-full">
          <Link href="/library">Go to my library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm" role="status">
      <Spinner /> Verifying your email…
    </div>
  );
}

/**
 * Magic links require an explicit click so that email security scanners which prefetch
 * links cannot burn the single-use token.
 */
export function MagicLogin() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: () =>
      api<{ user: PublicUser; redirectTo: string | null }>("/auth/magic-login", { method: "POST", body: { token } }),
    onSuccess: ({ user, redirectTo }) => {
      qc.clear();
      qc.setQueryData(meQueryKey, user);
      router.replace(safeNext(redirectTo, "/library"));
    },
  });

  if (!token || login.isError) {
    return (
      <div className="space-y-4 text-center">
        <XCircle className="text-destructive mx-auto size-10" aria-hidden />
        <p className="text-sm">{login.error?.message ?? "This sign-in link is incomplete."}</p>
        <Button asChild className="w-full">
          <Link href="/login">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">Click below to securely sign in on this device.</p>
      <Button size="lg" className="w-full" onClick={() => login.mutate()} disabled={login.isPending || login.isSuccess}>
        {login.isPending || login.isSuccess ? <Spinner /> : null}
        Continue to my library
      </Button>
    </div>
  );
}
