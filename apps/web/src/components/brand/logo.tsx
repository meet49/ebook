import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site";

export function Logo({ href = "/", className, suffix }: { href?: string; className?: string; suffix?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="bg-gradient-brand inline-flex size-8 items-center justify-center rounded-lg text-white shadow-sm">
        <BookOpen className="size-4" aria-hidden />
      </span>
      <span>{SITE_NAME}</span>
      {suffix ? <span className="text-muted-foreground font-normal">{suffix}</span> : null}
    </Link>
  );
}
