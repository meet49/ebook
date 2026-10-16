import {
  BarChart3,
  FileClock,
  Fingerprint,
  KeyRound,
  Link2,
  Lock,
  MailCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { cn } from "@/lib/utils";

/** Which story the brand panel beside the form tells. */
export type AuthPanel = "reader" | "affiliate" | "admin";

const POINT_ICONS: Record<AuthPanel, LucideIcon[]> = {
  reader: [Smartphone, Fingerprint, MailCheck],
  affiliate: [Link2, BarChart3, Wallet],
  admin: [Lock, FileClock, KeyRound],
};

/**
 * Auth screen frame: the form card, with a gradient brand panel beside it on large screens
 * (the panel is hidden on phones so the form comes first).
 */
export async function AuthCard({
  title,
  description,
  children,
  footer,
  badge,
  panel = "reader",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
  /** `false` shows the form card on its own. */
  panel?: AuthPanel | false;
}) {
  const t = await getMessages();
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:py-16">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -top-48 left-1/2 -z-10 size-160 -translate-x-1/2 rounded-full blur-3xl"
      />
      <div
        className={cn(
          "bg-card text-card-foreground animate-in fade-in-0 slide-in-from-bottom-2 grid w-full overflow-hidden rounded-3xl border shadow-xl shadow-black/5 duration-500 motion-reduce:animate-none dark:shadow-black/30",
          panel ? "max-w-md lg:max-w-5xl lg:grid-cols-[1.05fr_1fr]" : "max-w-md",
        )}
      >
        {panel ? <BrandPanel copy={t.auth.panel[panel]} icons={POINT_ICONS[panel]} /> : null}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mb-8 space-y-2">
            {badge}
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
            {description ? <p className="text-muted-foreground text-sm leading-relaxed">{description}</p> : null}
          </div>
          {children}
          {footer ? (
            <div className="text-muted-foreground mt-8 flex flex-col items-center gap-2 border-t pt-6 text-center text-sm">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type PanelCopy = Messages["auth"]["panel"][AuthPanel];

function BrandPanel({ copy, icons }: { copy: PanelCopy; icons: LucideIcon[] }) {
  return (
    <div className="bg-gradient-brand relative m-2 hidden overflow-hidden rounded-[1.25rem] p-10 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Deepens the gradient in dark mode so white text keeps its contrast. */}
      <div aria-hidden className="absolute inset-0 hidden bg-black/30 dark:block" />
      <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 -left-20 size-80 rounded-full bg-black/15 blur-3xl" />

      <div className="relative space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
          <Sparkles className="size-3.5" aria-hidden />
          {copy.eyebrow}
        </span>
        <p className="text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl">
          {copy.titleLead} <span className="font-display font-normal italic">{copy.titleAccent}</span>
        </p>
        <p className="max-w-sm leading-relaxed text-white/80">{copy.body}</p>
      </div>

      <ul className="relative mt-10 space-y-5">
        {copy.points.map((point, i) => {
          const Icon = icons[i] ?? Sparkles;
          return (
            <li key={point.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{point.title}</p>
                <p className="text-sm leading-relaxed text-white/75">{point.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="relative mt-10 flex items-center gap-2 text-xs text-white/70">
        <ShieldCheck className="size-4" aria-hidden />
        {copy.footnote}
      </p>
    </div>
  );
}
