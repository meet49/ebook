"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Portal } from "@ebook/shared";
import { RoleGate } from "@/components/auth/role-gate";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMessages } from "@/i18n/client";
import { PORTAL_LOGIN, useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LanguageSwitcher, ThemeToggle } from "./preferences";
import { UserMenu, initials } from "./user-menu";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (for section roots like /admin). */
  exact?: boolean;
  /** Other path prefixes that belong to this item (e.g. a book editor under a root list). */
  also?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface DashboardShellProps {
  portal: Portal;
  title: string;
  homeHref: string;
  nav: NavGroup[];
  children: ReactNode;
}

function isActive(pathname: string, { href, exact, also = [] }: NavItem) {
  if (also.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ nav, onNavigate }: { nav: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const label = useMessages().common.dashboard.navLabel;
  return (
    <nav className="flex flex-col gap-5" aria-label={label}>
      {nav.map((group, gi) => (
        <div key={group.label ?? gi} className="flex flex-col gap-0.5">
          {group.label ? (
            <p className="text-muted-foreground/80 px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">{group.label}</p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                {active && <span aria-hidden className="bg-gradient-brand absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full" />}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-gradient-brand text-white shadow-sm" : "bg-muted/70 group-hover:bg-background",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const t = useMessages().common.dashboard;
  const { data: user } = useMe();
  return (
    <div className="space-y-2 border-t p-3">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors"
      >
        {t.backToStore}
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
      {user ? (
        <div className="bg-background/60 flex items-center gap-3 rounded-xl border p-2.5">
          <Avatar className="size-9">
            <AvatarFallback className="bg-gradient-brand text-xs font-semibold text-white">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardShell({ portal, title, homeHref, nav, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useMessages().common.dashboard;
  const { data: user } = useMe();
  const current = nav.flatMap((g) => g.items).find((i) => isActive(pathname, i));

  return (
    <div className="bg-muted/40 dark:bg-background flex min-h-screen">
      <aside className="bg-sidebar sticky top-0 hidden h-screen w-68 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href={homeHref} suffix={title} className="text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks nav={nav} />
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/70 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur-xl sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label={t.openNav}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-76 gap-0 p-0">
              <SheetHeader className="h-16 justify-center border-b px-5">
                <SheetTitle asChild>
                  <div>
                    <Logo href={homeHref} suffix={title} className="text-sm" />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
              </div>
              <SidebarFooter />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="text-muted-foreground hidden text-xs sm:block">{title}</p>
            <p className="truncate text-sm font-semibold">{current?.label ?? title}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            {user ? <UserMenu user={user} afterLogout={PORTAL_LOGIN[portal]} /> : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <RoleGate portal={portal}>{children}</RoleGate>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? <p className="text-primary text-xs font-semibold tracking-wider uppercase">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description ? <p className="text-muted-foreground max-w-2xl text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
