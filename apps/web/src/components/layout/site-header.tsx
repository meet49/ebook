"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, BookOpen, Home, LogIn, Megaphone, Menu, Ticket, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/i18n/client";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LanguageSwitcher, ThemeToggle } from "./preferences";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  const pathname = usePathname();
  const t = useMessages().common.nav;
  const { data: user, isPending } = useMe();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    { href: "/ebooks", label: t.ebooks, icon: BookOpen },
    { href: "/membership", label: t.membership, icon: Ticket },
    { href: "/affiliates", label: t.affiliates, icon: Megaphone },
  ];
  const mobileNav = [
    { href: "/", label: t.home, icon: Home },
    ...nav,
    ...(user?.roles.includes("customer") ? [{ href: "/library", label: t.library, icon: BookMarked }] : []),
    ...(user ? [] : [{ href: "/login", label: t.signIn, icon: LogIn }, { href: "/register", label: t.createAccount, icon: UserPlus }]),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "bg-background/75 supports-[backdrop-filter]:bg-background/60 border-border shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="bg-muted/60 ml-2 hidden items-center gap-0.5 rounded-full border p-1 md:flex" aria-label={t.main}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href) ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <div className="hidden items-center sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          {isPending ? (
            <Skeleton className="size-8 rounded-full" />
          ) : user ? (
            <>
              {user.roles.includes("customer") && (
                <Button asChild variant="ghost" className="hidden rounded-full lg:inline-flex">
                  <Link href="/library">
                    <BookMarked /> {t.library}
                  </Link>
                </Button>
              )}
              <UserMenu user={user} />
            </>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/login">{t.signIn}</Link>
              </Button>
              <Button asChild className="shadow-primary/25 rounded-full shadow-md">
                <Link href="/ebooks">{t.browse}</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="rounded-full md:hidden" aria-label={t.openMenu}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 gap-0">
              <SheetHeader className="border-b">
                <SheetTitle asChild>
                  <div>
                    <Logo />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3" aria-label={t.menu}>
                {mobileNav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                      isActive(href) ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
              <Separator />
              <div className="flex items-center justify-between gap-2 p-4">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <div className="mt-auto p-4">
                <InstallAppButton variant="secondary" size="default" className="w-full" showWithoutPrompt />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
