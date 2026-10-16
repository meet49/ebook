"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, LayoutDashboard, LogOut, Megaphone, Settings, Shield } from "lucide-react";
import type { PublicUser } from "@ebook/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessages } from "@/i18n/client";
import { hasRole, useLogout } from "@/lib/auth";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ user, afterLogout = "/" }: { user: PublicUser; afterLogout?: string }) {
  const router = useRouter();
  const logout = useLogout();
  const t = useMessages().common.userMenu;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={t.account}>
          <Avatar className="ring-primary/20 size-8 ring-2">
            <AvatarFallback className="bg-gradient-brand text-xs font-semibold text-white">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="text-muted-foreground truncate text-xs">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasRole(user, "customer") && (
          <DropdownMenuItem asChild>
            <Link href="/library">
              <BookMarked /> {t.library}
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "affiliate") && (
          <DropdownMenuItem asChild>
            <Link href="/affiliate">
              <Megaphone /> {t.affiliate}
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> {t.admin}
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "customer") && (
          <DropdownMenuItem asChild>
            <Link href="/account">
              <Settings /> {t.settings}
            </Link>
          </DropdownMenuItem>
        )}
        {!hasRole(user, "customer") && !hasRole(user, "affiliate") && !hasRole(user, "admin") && (
          <DropdownMenuItem disabled>
            <LayoutDashboard /> {t.noDashboards}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => {
                router.replace(afterLogout);
                router.refresh();
              },
            })
          }
        >
          <LogOut /> {t.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
