import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

const COLUMNS = [
  {
    title: "Store",
    links: [
      { href: "/ebooks", label: "All eBooks" },
      { href: "/library", label: "My library" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/affiliates", label: "Affiliate program" },
      { href: "/affiliate/apply", label: "Apply" },
      { href: "/affiliate/login", label: "Affiliate sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/refunds", label: "Refund policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 mt-auto border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            Practical eBooks you can buy securely and start reading in seconds.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted-foreground hover:text-foreground text-sm">
            {SUPPORT_EMAIL}
          </a>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground text-sm">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground border-t py-6 text-center text-xs">
        © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
