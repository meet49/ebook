"use client";

import { Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, useMessages, useSetLocale } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

/** Light / dark / system. The icon swaps with CSS so it never flashes before hydration. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useMessages().common.theme;
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("rounded-full", className)} aria-label={t.toggle}>
          <Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t.label}</DropdownMenuLabel>
        {THEMES.map(({ value, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon /> {t[value]}
            {theme === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** English / हिन्दी. Saved in a cookie so server-rendered pages use it too. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useMessages().common.language;
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 rounded-full px-2.5", className)} aria-label={t.toggle}>
          <Languages />
          <span className="text-xs font-semibold">{LOCALE_LABELS[locale].short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{t.label}</DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => l !== locale && setLocale(l)} lang={l}>
            {LOCALE_LABELS[l].name}
            {l === locale && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Both controls side by side, for headers. */
export function PreferenceControls({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}
