"use client";

import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { ArrowRight, BadgeCheck, Bookmark, BookOpen, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { ProductSummary } from "@ebook/shared";
import { BookCover } from "@/components/products/book-cover";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import type { HomeMessages } from "@/i18n/messages/home";

export function Hero({ books }: { books: ProductSummary[] }) {
  const t = useMessages().home.hero;
  const reduce = useReducedMotion();
  const rise = (delay: number): HTMLMotionProps<"div"> =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] } };

  return (
    <section className="relative isolate -mt-16 overflow-hidden pt-16">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div aria-hidden className="absolute -top-48 left-1/2 -z-10 h-140 w-225 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_28%,transparent),transparent)]" />
      <div aria-hidden className="absolute top-40 -right-40 -z-10 size-105 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand-violet)_24%,transparent),transparent)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
        <div className="space-y-7">
          <motion.div {...rise(0)}>
            <Link
              href="/ebooks"
              className="group bg-background/70 text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium shadow-sm backdrop-blur transition-colors"
            >
              <span className="bg-gradient-brand inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white">
                <Sparkles className="size-3" aria-hidden /> {t.badge}
              </span>
              {t.badgeText}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </motion.div>

          <motion.h1 {...rise(0.06)} className="text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.1rem]">
            {t.titleStart} <span className="font-display text-gradient-brand font-normal italic">{t.titleAccent}</span>
            {t.titleEnd}
          </motion.h1>

          <motion.p {...rise(0.12)} className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty">
            {t.subtitle}
          </motion.p>

          <motion.div {...rise(0.18)} className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/30 h-12 rounded-full px-6 text-base shadow-lg">
              <Link href="/ebooks">
                {t.browse} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70 h-12 rounded-full px-6 text-base backdrop-blur">
              <Link href="/affiliates">{t.affiliate}</Link>
            </Button>
          </motion.div>

          <motion.div {...rise(0.24)} className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="text-success size-4" aria-hidden /> {t.secured}
            </span>
            <span className="flex flex-wrap gap-1.5" aria-label={t.paymentMethods}>
              {t.methods.map((m) => (
                <span key={m} className="bg-background/70 text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  {m}
                </span>
              ))}
            </span>
          </motion.div>
        </div>

        {books.length > 0 ? <BookStack books={books} t={t} reduce={Boolean(reduce)} /> : <ReaderMockup t={t} reduce={Boolean(reduce)} />}
      </div>
    </section>
  );
}

type HeroMessages = HomeMessages["hero"];

const floatAnim = (reduce: boolean, delay: number, distance = 8) =>
  reduce ? {} : { animate: { y: [0, -distance, 0] }, transition: { duration: 5, delay, repeat: Infinity, ease: "easeInOut" as const } };

/** Up to three real covers fanned out on a glowing stage. Each links to its book. */
function BookStack({ books, t, reduce }: { books: ProductSummary[]; t: HeroMessages; reduce: boolean }) {
  const shown = books.slice(0, 3);
  // Middle book in front; the others tilt away behind it.
  const layout =
    shown.length === 1
      ? [{ x: "0%", rotate: 0, scale: 1, z: 30 }]
      : shown.length === 2
        ? [
            { x: "-26%", rotate: -7, scale: 0.92, z: 10 },
            { x: "22%", rotate: 5, scale: 1, z: 30 },
          ]
        : [
            { x: "-62%", rotate: -10, scale: 0.84, z: 10 },
            { x: "0%", rotate: 0, scale: 1, z: 30 },
            { x: "62%", rotate: 10, scale: 0.84, z: 20 },
          ];
  const order = shown.length === 3 ? [shown[1]!, shown[0]!, shown[2]!] : shown;

  return (
    <div className="relative mx-auto flex h-105 w-full max-w-140 items-center justify-center sm:h-120">
      <div aria-hidden className="from-primary/25 to-brand-violet/25 absolute inset-x-6 bottom-6 h-24 rounded-[50%] bg-linear-to-r blur-3xl" />
      <div aria-hidden className="border-primary/15 bg-background/40 absolute inset-x-4 top-10 bottom-10 rounded-[2.5rem] border backdrop-blur-sm sm:inset-x-8" />
      {order.map((book, i) => {
        const pos = layout[i]!;
        return (
          <motion.div
            key={book.id}
            initial={reduce ? false : { opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: pos.rotate, x: pos.x, scale: pos.scale }}
            transition={{ duration: 0.8, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ zIndex: pos.z }}
            className="absolute w-40 sm:w-48"
          >
            <Link href={`/ebooks/${book.slug}`} className="block transition-transform duration-300 hover:-translate-y-2" aria-label={book.title}>
              <BookCover src={book.coverUrl} title={book.title} priority sizes="200px" className="shadow-2xl shadow-indigo-950/30" />
            </Link>
          </motion.div>
        );
      })}

      <motion.div {...floatAnim(reduce, 0)} className="absolute top-4 -left-2 z-40 sm:-left-6" aria-hidden>
        <FloatCard icon={<BadgeCheck className="text-success size-4" />} title={t.float.verified} sub={t.float.verifiedSub} />
      </motion.div>
      <motion.div {...floatAnim(reduce, 1.2, 10)} className="absolute -right-1 bottom-10 z-40 sm:-right-6" aria-hidden>
        <FloatCard icon={<Bookmark className="text-primary size-4" />} title={t.float.bookmark} sub={t.float.bookmarkSub} />
      </motion.div>
      <motion.div {...floatAnim(reduce, 2.1, 6)} className="absolute bottom-0 left-8 z-40 hidden sm:block" aria-hidden>
        <FloatCard icon={<Zap className="size-4 text-amber-500" />} title={t.float.synced} sub={t.float.syncedSub} />
      </motion.div>
    </div>
  );
}

/** A stylised preview of the actual reader: an open book spread inside a device frame. */
function ReaderMockup({ t, reduce }: { t: HeroMessages; reduce: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={reduce ? false : { opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-140 perspective-[1200px]"
    >
      <div className="rounded-[1.6rem] border border-black/10 bg-neutral-900 p-2.5 shadow-2xl shadow-indigo-900/25 sm:p-3 dark:border-white/10">
        <div className="overflow-hidden rounded-[1.1rem] bg-neutral-100">
          <div className="flex items-center gap-2 border-b border-black/5 bg-white/80 px-3 py-2">
            <span className="bg-gradient-brand size-5 rounded-md" />
            <div className="space-y-1">
              <div className="h-1.5 w-24 rounded bg-neutral-800/70" />
              <div className="h-1 w-14 rounded bg-neutral-400/60" />
            </div>
            <div className="ml-auto flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-4 rounded bg-neutral-200" />
              ))}
            </div>
          </div>

          <div className="relative flex justify-center px-4 py-5 sm:px-7 sm:py-7">
            <div className="relative flex w-full shadow-xl shadow-black/10">
              <MockPage side="left" heading={t.mockChapter} />
              <div className="w-px bg-linear-to-b from-black/5 via-black/20 to-black/5" />
              <MockPage side="right" />
              <div className="absolute right-0 bottom-0 size-10 overflow-hidden sm:size-14">
                <div className="absolute right-0 bottom-0 size-full rounded-tl-[60%] bg-linear-to-tl from-neutral-300 via-neutral-100 to-white shadow-[-4px_-4px_10px_rgba(0,0,0,0.12)]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-black/5 bg-white/80 px-4 py-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-[64%] rounded-full bg-indigo-600" />
            </div>
            <span className="text-[10px] font-medium text-neutral-500 tabular-nums">{t.mockProgress}</span>
          </div>
        </div>
      </div>

      <motion.div {...floatAnim(reduce, 0)} className="absolute -top-5 -left-3 sm:-left-10">
        <FloatCard icon={<BadgeCheck className="text-success size-4" />} title={t.float.verified} sub={t.float.verifiedSub} />
      </motion.div>
      <motion.div {...floatAnim(reduce, 1.2, 10)} className="absolute -right-2 bottom-16 sm:-right-8">
        <FloatCard icon={<Bookmark className="text-primary size-4" />} title={t.float.bookmark} sub={t.float.bookmarkSub} />
      </motion.div>
      <motion.div {...floatAnim(reduce, 2.1, 6)} className="absolute -bottom-6 left-6 hidden sm:block">
        <FloatCard icon={<Zap className="size-4 text-amber-500" />} title={t.float.synced} sub={t.float.syncedSub} />
      </motion.div>
    </motion.div>
  );
}

function MockPage({ side, heading }: { side: "left" | "right"; heading?: string }) {
  const widths = side === "left" ? [92, 100, 86, 97, 74, 100, 90, 60] : [100, 94, 98, 82, 100, 91, 96, 70, 88];
  return (
    <div className={`flex-1 bg-white px-3 py-4 sm:px-5 sm:py-6 ${side === "left" ? "rounded-l-md" : "rounded-r-md"}`}>
      {heading ? (
        <div className="mb-3 flex items-center gap-1.5">
          <BookOpen className="size-3 text-indigo-600" />
          <span className="font-display text-sm text-indigo-600 italic sm:text-base">{heading}</span>
        </div>
      ) : (
        <div className="mb-3 h-10 rounded-md bg-indigo-50 sm:h-14" />
      )}
      <div className="space-y-1.5">
        {widths.map((w, i) => (
          <div key={i} className="h-1 rounded-full bg-neutral-300/80 sm:h-1.5" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function FloatCard({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-background/90 flex items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-lg shadow-indigo-900/10 backdrop-blur">
      <span className="bg-muted flex size-8 items-center justify-center rounded-xl">{icon}</span>
      <span>
        <span className="block text-xs font-semibold">{title}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
    </div>
  );
}
