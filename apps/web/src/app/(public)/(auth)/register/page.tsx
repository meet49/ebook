import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Your purchases will be saved to your personal library."
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs">
            By creating an account you agree to our{" "}
            <Link href="/legal/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>
            .
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
