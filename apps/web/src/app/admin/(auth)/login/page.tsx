import type { Metadata } from "next";
import { PortalLoginPage } from "@/components/auth/portal-login-page";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <PortalLoginPage
      portal="admin"
      label="Admin portal"
      title="Admin sign in"
      description="Restricted to store administrators."
    />
  );
}
