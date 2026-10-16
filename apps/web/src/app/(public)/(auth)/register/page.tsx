import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.meta.register };
}

export default async function RegisterPage() {
  const t = (await getMessages()).auth.register;
  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <>
          <p>
            {t.haveAccount}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              {t.signIn}
            </Link>
          </p>
          <p className="text-xs leading-relaxed">
            {t.agreeLead}
            <Link href="/legal/terms" className="hover:text-foreground underline underline-offset-4">
              {t.terms}
            </Link>
            {t.and}
            <Link href="/legal/privacy" className="hover:text-foreground underline underline-offset-4">
              {t.privacy}
            </Link>
            {t.agreeTail}
          </p>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
