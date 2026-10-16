import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { MagicLogin } from "@/components/auth/token-actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function MagicLoginPage() {
  return (
    <AuthCard title="Sign in to your library">
      <Suspense>
        <MagicLogin />
      </Suspense>
    </AuthCard>
  );
}
