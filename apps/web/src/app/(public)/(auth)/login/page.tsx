import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to read your eBooks."
      footer={
        <>
          <p>
            New here?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
          <p className="text-xs">
            Affiliate?{" "}
            <Link href="/affiliate/login" className="hover:underline">
              Sign in to the affiliate dashboard
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
