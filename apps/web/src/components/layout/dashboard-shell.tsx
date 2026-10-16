"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Portal } from "@ebook/shared";
import { RoleGate } from "@/components/auth/role-gate";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PORTAL_LOGIN, useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (for section roots like /admin). */
  exact?: boolean;
}

interface DashboardShellProps {
  portal: Portal;
  title: string;
  homeHref: string;
  nav: NavItem[];
  children: ReactNode;
}

function NavLinks({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Dashboard">
      {nav.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ portal, title, homeHref, nav, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const { data: user } = useMe();

  return (
    <div className="bg-muted/30 flex min-h-screen">
      <aside className="bg-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Logo href={homeHref} suffix={title} className="text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks nav={nav} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b">
                <SheetTitle asChild>
                  <div>
                    <Logo href={homeHref} suffix={title} className="text-sm" />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold lg:hidden">{title}</span>
          <div className="ml-auto">{user ? <UserMenu user={user} afterLogout={PORTAL_LOGIN[portal]} /> : null}</div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <RoleGate portal={portal}>{children}</RoleGate>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
