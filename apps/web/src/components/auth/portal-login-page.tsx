import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import type { Portal } from "@ebook/shared";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { PreferenceControls } from "@/components/layout/preferences";
import { Badge } from "@/components/ui/badge";
import { getMessages } from "@/i18n/server";

/** Standalone sign-in screen for the affiliate and admin portals. */
export async function PortalLoginPage({
  portal,
  label,
  title,
  description,
  footer,
}: {
  portal: Portal;
  label: ReactNode;
  title: ReactNode;
  description: ReactNode;
  footer?: ReactNode;
}) {
  const t = await getMessages();
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md text-sm transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t.common.dashboard.backToStore}
          </Link>
          <PreferenceControls />
        </div>
      </div>
      <AuthCard
        panel={portal === "customer" ? "reader" : portal}
        badge={
          <Badge variant="secondary" className="mb-2 w-fit">
            {label}
          </Badge>
        }
        title={title}
        description={description}
        footer={footer}
      >
        <Suspense>
          <LoginForm portal={portal} />
        </Suspense>
      </AuthCard>
    </div>
  );
}
