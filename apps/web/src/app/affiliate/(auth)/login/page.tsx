import type { Metadata } from "next";
import Link from "next/link";
import { PortalLoginPage } from "@/components/auth/portal-login-page";

export const metadata: Metadata = { title: "Affiliate sign in" };

export default function AffiliateLoginPage() {
  return (
    <PortalLoginPage
      portal="affiliate"
      label="Affiliate portal"
      title="Affiliate sign in"
      description="Track your referral links, sales and commissions."
      footer={
        <>
          <p>
            Not an affiliate yet?{" "}
            <Link href="/affiliate/apply" className="text-primary font-medium hover:underline">
              Apply now
            </Link>
          </p>
          <p className="text-xs">
            <Link href="/affiliates" className="hover:underline">
              How the affiliate program works
            </Link>
          </p>
        </>
      }
    />
  );
}
