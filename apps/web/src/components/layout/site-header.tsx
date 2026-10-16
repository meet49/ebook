"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/ebooks", label: "eBooks" },
  { href: "/affiliates", label: "Affiliate program" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: user, isPending } = useMe();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href) && "text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isPending ? (
            <Skeleton className="size-8 rounded-full" />
          ) : user ? (
            <>
              {user.roles.includes("customer") && (
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/library">My library</Link>
                </Button>
              )}
              <UserMenu user={user} />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/ebooks">Browse eBooks</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {[...NAV, ...(user ? [] : [{ href: "/login", label: "Sign in" }, { href: "/register", label: "Create account" }])].map(
                  (item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="hover:bg-muted rounded-lg px-3 py-2.5 text-sm font-medium"
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
