import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.meta.forgot };
}

export default async function ForgotPasswordPage() {
  const t = (await getMessages()).auth.forgot;
  return (
    <AuthCard
      title={t.title}
      description={t.description}
      footer={
        <Link href="/login" className="hover:text-foreground inline-flex items-center gap-1.5 font-medium">
          <ArrowLeft className="size-4" aria-hidden />
          {t.back}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
