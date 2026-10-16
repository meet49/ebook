import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmail } from "@/components/auth/token-actions";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.meta.verify, robots: { index: false } };
}

export default async function VerifyEmailPage() {
  const t = (await getMessages()).auth.verify;
  return (
    <AuthCard title={t.title}>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
