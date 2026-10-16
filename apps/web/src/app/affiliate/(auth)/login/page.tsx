import type { Metadata } from "next";
import Link from "next/link";
import { PortalLoginPage } from "@/components/auth/portal-login-page";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).affiliate.login.metaTitle };
}

export default async function AffiliateLoginPage() {
  const t = (await getMessages()).affiliate.login;
  return (
    <PortalLoginPage
      portal="affiliate"
      label={t.label}
      title={t.title}
      description={t.description}
      footer={
        <>
          <p>
            {t.notYet}{" "}
            <Link href="/affiliate/apply" className="text-primary font-medium hover:underline">
              {t.applyNow}
            </Link>
          </p>
          <p className="text-xs">
            <Link href="/affiliates" className="hover:underline">
              {t.howItWorks}
            </Link>
          </p>
        </>
      }
    />
  );
}
