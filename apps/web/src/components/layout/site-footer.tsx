import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { InstallAppButton } from "@/components/pwa/install-app";
import { getMessages } from "@/i18n/server";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export async function SiteFooter() {
  const t = (await getMessages()).common;
  const columns = [
    {
      title: t.footer.store,
      links: [
        { href: "/ebooks", label: t.footer.allEbooks },
        { href: "/library", label: t.nav.library },
        { href: "/login", label: t.nav.signIn },
      ],
    },
    {
      title: t.footer.partners,
      links: [
        { href: "/affiliates", label: t.nav.affiliates },
        { href: "/affiliate/apply", label: t.footer.apply },
        { href: "/affiliate/login", label: t.footer.affiliateSignIn },
      ],
    },
    {
      title: t.footer.help,
      links: [
        { href: "/contact", label: t.footer.contact },
        { href: "/legal/terms", label: t.footer.terms },
        { href: "/legal/privacy", label: t.footer.privacy },
        { href: "/legal/refunds", label: t.footer.refunds },
        { href: "/legal/delivery", label: t.footer.delivery },
      ],
    },
  ];

  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t">
      <div aria-hidden className="bg-gradient-brand absolute inset-x-0 top-0 h-px opacity-40" />
      <div aria-hidden className="absolute -bottom-40 left-1/2 -z-10 h-80 w-175 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">{t.siteTagline}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted-foreground hover:text-foreground block text-sm">
            {SUPPORT_EMAIL}
          </a>
          <InstallAppButton className="rounded-full" />
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row sm:px-6">
          <span>{t.footer.rights(new Date().getFullYear(), SITE_NAME)}</span>
          <span>{t.footer.madeIn}</span>
        </div>
      </div>
    </footer>
  );
}
