import type { Metadata } from "next";
import Link from "next/link";
import { PortalLoginPage } from "@/components/auth/portal-login-page";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).author.login.metaTitle };
}

export default async function AuthorLoginPage() {
  const t = (await getMessages()).author.login;
  return (
    <PortalLoginPage
      portal="author"
      label={t.label}
      title={t.title}
      description={t.description}
      footer={
        <>
          <p>
            {t.notYet}{" "}
            <Link href="/author/apply" className="text-primary font-medium hover:underline">
              {t.applyNow}
            </Link>
          </p>
          <p className="text-xs">
            <Link href="/authors" className="hover:underline">
              {t.howItWorks}
            </Link>
          </p>
        </>
      }
    />
  );
}
