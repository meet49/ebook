"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import type { PublicUser } from "@ebook/shared";
import { AuthStatus } from "@/components/auth/auth-status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { meQueryKey, safeNext } from "@/lib/auth";

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const t = useMessages().auth.token;
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
      <AuthStatus
        tone="destructive"
        icon={XCircle}
        title={t.verifyFailedTitle}
        actions={
          <Button asChild className="w-full">
            <Link href="/account">{t.goToSettings}</Link>
          </Button>
        }
      >
        <p>{verify.error?.message ?? t.verifyIncomplete}</p>
        <p className="mt-1">{t.verifyHelp}</p>
      </AuthStatus>
    );
  }

  if (verify.isSuccess) {
    return (
      <AuthStatus
        tone="success"
        icon={CheckCircle2}
        title={t.verifiedTitle}
        actions={
          <Button asChild className="w-full">
            <Link href="/library">
              {t.goToLibrary}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      >
        {t.verified}
      </AuthStatus>
    );
  }

  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm" role="status">
      <Spinner /> {t.verifying}
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
  const t = useMessages().auth.token;
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
      <AuthStatus
        tone="destructive"
        icon={XCircle}
        title={t.magicFailedTitle}
        actions={
          <Button asChild className="w-full">
            <Link href="/login">{t.requestNew}</Link>
          </Button>
        }
      >
        {login.error?.message ?? t.magicIncomplete}
      </AuthStatus>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm leading-relaxed">{t.magicIntro}</p>
      <Button size="lg" className="h-11 w-full" onClick={() => login.mutate()} disabled={login.isPending || login.isSuccess}>
        {login.isPending || login.isSuccess ? <Spinner /> : null}
        {t.continue}
        {login.isPending || login.isSuccess ? null : <ArrowRight aria-hidden />}
      </Button>
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5" aria-hidden />
        {t.magicNote}
      </p>
    </div>
  );
}
