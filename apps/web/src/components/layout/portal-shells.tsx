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
  TicketPercent,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { useMessages } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { DashboardShell, type NavGroup } from "./dashboard-shell";

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useMessages().common.dashboard;
  const a = t.admin;
  const nav: NavGroup[] = [
    { items: [{ href: "/admin", label: a.overview, icon: LayoutDashboard, exact: true }] },
    {
      label: a.groups.store,
      items: [
        { href: "/admin/products", label: a.products, icon: BookOpen },
        { href: "/admin/orders", label: a.orders, icon: Receipt },
        { href: "/admin/customers", label: a.customers, icon: Users },
        { href: "/admin/coupons", label: a.coupons, icon: TicketPercent },
      ],
    },
    {
      label: a.groups.partners,
      items: [
        { href: "/admin/affiliates", label: a.affiliates, icon: UsersRound },
        { href: "/admin/commissions", label: a.commissions, icon: HandCoins },
        { href: "/admin/payouts", label: a.payouts, icon: Wallet },
      ],
    },
    {
      label: a.groups.system,
      items: [
        { href: "/admin/audit", label: a.audit, icon: FileClock },
        { href: "/admin/settings", label: a.settings, icon: Settings },
      ],
    },
  ];
  return (
    <DashboardShell portal="admin" title={t.portals.admin} homeHref="/admin" nav={nav}>
      {children}
    </DashboardShell>
  );
}

export function AffiliateShell({ children }: { children: ReactNode }) {
  const t = useMessages().common.dashboard;
  const a = t.affiliate;
  const nav: NavGroup[] = [
    {
      items: [
        { href: "/affiliate", label: a.overview, icon: BarChart3, exact: true },
        { href: "/affiliate/products", label: a.products, icon: Link2 },
        { href: "/affiliate/commissions", label: a.commissions, icon: HandCoins },
        { href: "/affiliate/payouts", label: a.payouts, icon: Wallet },
        { href: "/affiliate/profile", label: a.profile, icon: UserCircle },
      ],
    },
  ];
  return (
    <DashboardShell portal="affiliate" title={t.portals.affiliate} homeHref="/affiliate" nav={nav}>
      {children}
    </DashboardShell>
  );
}

/** Customer area: storefront header (rendered by the layout) plus pill tabs, no sidebar. */
export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useMessages().common.dashboard.customer;
  const tabs = [
    { href: "/library", label: t.books, icon: BookMarked, exact: true },
    { href: "/library/bookmarks", label: t.bookmarks, icon: Bookmark },
    { href: "/library/orders", label: t.orders, icon: ScrollText },
    { href: "/account", label: t.account, icon: Settings },
  ];
  return (
    <RoleGate portal="customer">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <nav
          className="bg-muted/60 mb-8 flex w-full gap-1 overflow-x-auto rounded-2xl border p-1 scrollbar-none sm:w-fit"
          aria-label={t.label}
        >
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} aria-hidden />
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
