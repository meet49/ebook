import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.meta.signIn };
}

export default async function LoginPage() {
  const t = (await getMessages()).auth.login;
  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <>
          <p>
            {t.newHere}{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              {t.createAccount}
            </Link>
          </p>
          <p className="text-xs">
            {t.affiliate}{" "}
            <Link href="/affiliate/login" className="hover:text-foreground underline-offset-4 hover:underline">
              {t.affiliateLink}
            </Link>
          </p>
        </>
      }
    >
      <Suspense>
        <LoginForm portal="customer" />
      </Suspense>
    </AuthCard>
  );
}
