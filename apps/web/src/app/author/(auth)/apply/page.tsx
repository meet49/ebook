import type { Metadata } from "next";
import { BadgeIndianRupee, Fingerprint, Megaphone, PenLine } from "lucide-react";
import { AuthorApplyForm } from "@/components/author/apply-form";
import { Logo } from "@/components/brand/logo";
import { PreferenceControls } from "@/components/layout/preferences";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getMessages()).author.apply;
  return { title: t.metaTitle, description: t.pitchBody, alternates: { canonical: "/author/apply" } };
}

const BENEFIT_ICONS = [PenLine, Fingerprint, Megaphone, BadgeIndianRupee];

export default async function AuthorApplyPage() {
  const t = (await getMessages()).author.apply;
  return (
    <div className="bg-muted/40 dark:bg-background relative flex min-h-screen flex-col overflow-x-clip">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-130" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <PreferenceControls />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-14">
        <section className="space-y-6 lg:sticky lg:top-10 lg:self-start lg:pt-6">
          <Badge variant="secondary" className="w-fit">
            {t.badge}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.pitchTitle} <span className="font-display text-gradient-brand font-normal italic">{t.pitchAccent}</span>
          </h1>
          <p className="text-muted-foreground max-w-lg text-base">{t.pitchBody}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!;
              return (
                <li key={b.title} className="bg-card/80 flex gap-3 rounded-2xl border p-4 backdrop-blur">
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{b.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Card className="rounded-3xl shadow-xl shadow-indigo-900/5">
          <CardHeader>
            <CardTitle className="text-xl">{t.formTitle}</CardTitle>
            <CardDescription>{t.formDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthorApplyForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
