"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Bookmark,
  FileClock,
  HandCoins,
  LayoutDashboard,
  Link2,
  Receipt,
  ScrollText,
  Settings,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils";
import { DashboardShell, type NavItem } from "./dashboard-shell";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "eBooks", icon: BookOpen },
  { href: "/admin/orders", label: "Orders & refunds", icon: Receipt },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/affiliates", label: "Affiliates", icon: UsersRound },
  { href: "/admin/commissions", label: "Commission ledger", icon: HandCoins },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const AFFILIATE_NAV: NavItem[] = [
  { href: "/affiliate", label: "Overview", icon: BarChart3, exact: true },
  { href: "/affiliate/products", label: "Products & links", icon: Link2 },
  { href: "/affiliate/commissions", label: "Commissions", icon: HandCoins },
  { href: "/affiliate/payouts", label: "Payouts", icon: Wallet },
  { href: "/affiliate/profile", label: "Profile", icon: UserCircle },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell portal="admin" title="Admin" homeHref="/admin" nav={ADMIN_NAV}>
      {children}
    </DashboardShell>
  );
}

export function AffiliateShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell portal="affiliate" title="Affiliates" homeHref="/affiliate" nav={AFFILIATE_NAV}>
      {children}
    </DashboardShell>
  );
}

const CUSTOMER_TABS = [
  { href: "/library", label: "My books", icon: BookMarked, exact: true },
  { href: "/library/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/library/orders", label: "Orders", icon: ScrollText },
  { href: "/account", label: "Account", icon: Settings },
];

/** Customer area: storefront header (rendered by the layout) plus a light tab bar, no sidebar. */
export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGate portal="customer">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b" aria-label="Library">
          {CUSTOMER_TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </RoleGate>
  );
}
