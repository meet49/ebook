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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
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
              <BookMarked /> My library
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "affiliate") && (
          <DropdownMenuItem asChild>
            <Link href="/affiliate">
              <Megaphone /> Affiliate dashboard
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield /> Admin
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(user, "customer") && (
          <DropdownMenuItem asChild>
            <Link href="/account">
              <Settings /> Account settings
            </Link>
          </DropdownMenuItem>
        )}
        {!hasRole(user, "customer") && !hasRole(user, "affiliate") && !hasRole(user, "admin") && (
          <DropdownMenuItem disabled>
            <LayoutDashboard /> No dashboards
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
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
