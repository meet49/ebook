import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmail } from "@/components/auth/token-actions";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Email verification">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
