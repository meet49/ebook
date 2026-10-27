import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, PenLine, Upload } from "lucide-react";
import { formatINR } from "@ebook/shared";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n/messages";

const STEP_ICONS = [PenLine, Upload, BadgeIndianRupee];

/** The worked example: a ₹200 sale through an affiliate (20%) with the default 70% author share. */
const SALE = 20_000;
const AFFILIATE = Math.floor((SALE * 20) / 100);
const AUTHOR = Math.floor(((SALE - AFFILIATE) * 70) / 100);
const PLATFORM = SALE - AFFILIATE - AUTHOR;

/** Home page invitation for writers: three steps and a transparent split of one sale. */
export function AuthorsSection({ t }: { t: Messages["home"]["authors"] }) {
  const segments = [
    { key: "you", label: t.rows.you, amount: AUTHOR, className: "bg-primary" },
    { key: "affiliate", label: t.rows.affiliate, amount: AFFILIATE, className: "bg-brand-violet/60" },
    { key: "platform", label: t.rows.platform, amount: PLATFORM, className: "bg-muted-foreground/35" },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="authors-heading">
      <div className="relative isolate grid items-center gap-10 overflow-hidden rounded-[2rem] border bg-[linear-gradient(160deg,var(--accent),var(--card)_55%)] p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:p-14">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-50" />

        <div className="space-y-7">
          <span className="bg-background text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm">
            <PenLine className="size-3.5" aria-hidden /> {t.badge}
          </span>
          <h2 id="authors-heading" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.titleStart} <span className="font-display text-gradient-brand font-normal italic">{t.titleAccent}</span>
          </h2>
          <p className="text-muted-foreground max-w-lg">{t.body}</p>

          <ol className="grid gap-3 sm:grid-cols-3">
            {t.steps.map((s, i) => {
              const Icon = STEP_ICONS[i] ?? PenLine;
              return (
                <li key={s.title} className="bg-background/80 relative flex items-center gap-3 rounded-2xl border p-3.5 backdrop-blur sm:block sm:p-4">
                  <span className="bg-gradient-brand flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-900/20">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-muted-foreground absolute top-3.5 right-3.5 text-xs font-semibold tabular-nums sm:top-4 sm:right-4">0{i + 1}</span>
                  <div className="min-w-0 pr-6 sm:pr-0">
                    <p className="text-sm font-semibold sm:mt-3">{s.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="shadow-primary/25 h-12 rounded-full px-6 shadow-lg">
              <Link href="/author/apply">
                {t.apply} <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70 h-12 rounded-full px-6">
              <Link href="/authors">{t.details}</Link>
            </Button>
          </div>
        </div>

        {/* Where one sale goes */}
        <div className="bg-card rounded-3xl border p-6 shadow-xl shadow-indigo-900/5 sm:p-7">
          <p className="text-muted-foreground text-sm font-medium">{t.exampleTitle}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatINR(SALE)}</p>
          <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label}: ${formatINR(s.amount)}`).join(", ")}>
            {segments.map((s) => (
              <div key={s.key} className={s.className} style={{ width: `${(s.amount / SALE) * 100}%` }} />
            ))}
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <span className={`size-2.5 shrink-0 rounded-full ${s.className}`} aria-hidden />
                  {s.label}
                </dt>
                <dd className={s.key === "you" ? "text-lg font-semibold tabular-nums" : "font-medium tabular-nums"}>{formatINR(s.amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-5 border-t pt-4 text-xs leading-relaxed">{t.exampleNote}</p>
        </div>
      </div>
    </section>
  );
}
