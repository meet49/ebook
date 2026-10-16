import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { Portal } from "@ebook/shared";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";

/** Standalone sign-in screen for the affiliate and admin portals. */
export function PortalLoginPage({
  portal,
  label,
  title,
  description,
  footer,
}: {
  portal: Portal;
  label: string;
  title: string;
  description: string;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          Back to store
        </Link>
      </div>
      <AuthCard
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
