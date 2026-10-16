import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  destructive: "bg-destructive/10 text-destructive",
} as const;

/** Result screen inside an auth card: "check your inbox", "verified", "link expired"… */
export function AuthStatus({
  tone = "primary",
  icon: Icon,
  title,
  children,
  actions,
}: {
  tone?: keyof typeof TONES;
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className="animate-in fade-in-0 zoom-in-95 space-y-5 text-center duration-300 motion-reduce:animate-none"
      role={tone === "destructive" ? "alert" : "status"}
    >
      <span className={cn("mx-auto flex size-14 items-center justify-center rounded-2xl", TONES[tone])}>
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        {children ? <div className="text-muted-foreground text-sm leading-relaxed">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
    </div>
  );
}
