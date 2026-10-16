import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { MagicLogin } from "@/components/auth/token-actions";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.meta.signIn, robots: { index: false } };
}

export default async function MagicLoginPage() {
  const t = (await getMessages()).auth.magic;
  return (
    <AuthCard title={t.title} description={t.description}>
      <Suspense>
        <MagicLogin />
      </Suspense>
    </AuthCard>
  );
}
