"use client";

import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { ArrowRight, BadgeCheck, Bookmark, BookOpen, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAYMENT_METHODS = ["UPI", "Cards", "NetBanking", "Wallets"];

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number): HTMLMotionProps<"div"> =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] } };

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div aria-hidden className="absolute -top-48 left-1/2 -z-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.85_0.09_280/0.55),transparent)]" />
      <div aria-hidden className="absolute top-40 -right-40 -z-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,oklch(0.88_0.08_310/0.5),transparent)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
        <div className="space-y-7">
          <motion.div {...rise(0)}>
            <Link
              href="/ebooks"
              className="group bg-background/70 text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium shadow-sm backdrop-blur transition-colors"
            >
              <span className="bg-gradient-brand inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white">
                <Sparkles className="size-3" aria-hidden /> New
              </span>
              Start reading seconds after you pay
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </motion.div>

          <motion.h1 {...rise(0.06)} className="text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]">
            Books that teach you{" "}
            <span className="font-display text-gradient-brand pr-1 font-normal italic">something real</span>,{" "}
            in a reader you&apos;ll love.
          </motion.h1>

          <motion.p {...rise(0.12)} className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty">
            Expert-written, practical eBooks. Pay securely in seconds, then read with realistic page turns, bookmarks and
            synced progress — on your phone, tablet or laptop.
          </motion.p>

          <motion.div {...rise(0.18)} className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/25 h-12 px-6 text-base shadow-lg">
              <Link href="/ebooks">
                Browse the collection <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70 h-12 px-6 text-base backdrop-blur">
              <Link href="/affiliates">Earn as an affiliate</Link>
            </Button>
          </motion.div>

          <motion.div {...rise(0.24)} className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="text-success size-4" aria-hidden /> Secured by Razorpay
            </span>
            <span className="flex flex-wrap gap-1.5" aria-label="Accepted payment methods">
              {PAYMENT_METHODS.map((m) => (
                <span key={m} className="bg-background/70 text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
                  {m}
                </span>
              ))}
            </span>
          </motion.div>
        </div>

        <ReaderMockup reduce={Boolean(reduce)} />
      </div>
    </section>
  );
}

/** A stylised preview of the actual reader: an open book spread inside a device frame. */
function ReaderMockup({ reduce }: { reduce: boolean }) {
  const float = (delay: number, distance = 8) =>
    reduce ? {} : { animate: { y: [0, -distance, 0] }, transition: { duration: 5, delay, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <motion.div
      aria-hidden
      initial={reduce ? false : { opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[560px] perspective-[1200px]"
    >
      {/* Device */}
      <div className="rounded-[1.6rem] border border-black/10 bg-neutral-900 p-2.5 shadow-2xl shadow-indigo-900/25 sm:p-3">
        <div className="overflow-hidden rounded-[1.1rem] bg-neutral-100">
          {/* Reader top bar */}
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

          {/* Open book spread */}
          <div className="relative flex justify-center px-4 py-5 sm:px-7 sm:py-7">
            <div className="relative flex w-full shadow-xl shadow-black/10">
              <Page side="left" heading="Chapter 3" />
              <div className="w-px bg-linear-to-b from-black/5 via-black/20 to-black/5" />
              <Page side="right" />
              {/* Page curl */}
              <div className="absolute right-0 bottom-0 size-10 overflow-hidden sm:size-14">
                <div className="absolute right-0 bottom-0 size-full rounded-tl-[60%] bg-linear-to-tl from-neutral-300 via-neutral-100 to-white shadow-[-4px_-4px_10px_rgba(0,0,0,0.12)]" />
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 border-t border-black/5 bg-white/80 px-4 py-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="bg-primary h-full w-[64%] rounded-full" />
            </div>
            <span className="text-[10px] font-medium text-neutral-500 tabular-nums">p. 42 of 66 · 64%</span>
          </div>
        </div>
      </div>

      {/* Floating status cards */}
      <motion.div {...float(0)} className="absolute -top-5 -left-3 sm:-left-10">
        <FloatCard icon={<BadgeCheck className="text-success size-4" />} title="Payment verified" sub="Added to your library" />
      </motion.div>
      <motion.div {...float(1.2, 10)} className="absolute -right-2 bottom-16 sm:-right-8">
        <FloatCard icon={<Bookmark className="text-primary size-4" />} title="Bookmark saved" sub="Page 42" />
      </motion.div>
      <motion.div {...float(2.1, 6)} className="absolute -bottom-6 left-6 hidden sm:block">
        <FloatCard icon={<Zap className="size-4 text-amber-500" />} title="Synced" sub="Continue on any device" />
      </motion.div>
    </motion.div>
  );
}

function Page({ side, heading }: { side: "left" | "right"; heading?: string }) {
  const widths = side === "left" ? [92, 100, 86, 97, 74, 100, 90, 60] : [100, 94, 98, 82, 100, 91, 96, 70, 88];
  return (
    <div className={`flex-1 bg-white px-3 py-4 sm:px-5 sm:py-6 ${side === "left" ? "rounded-l-md" : "rounded-r-md"}`}>
      {heading ? (
        <div className="mb-3 flex items-center gap-1.5">
          <BookOpen className="text-primary size-3" />
          <span className="font-display text-primary text-sm italic sm:text-base">{heading}</span>
        </div>
      ) : (
        <div className="bg-accent mb-3 h-10 rounded-md sm:h-14" />
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
    <div className="bg-background/90 flex items-center gap-2.5 rounded-xl border px-3 py-2 shadow-lg shadow-indigo-900/10 backdrop-blur">
      <span className="bg-muted flex size-8 items-center justify-center rounded-lg">{icon}</span>
      <span>
        <span className="block text-xs font-semibold">{title}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
    </div>
  );
}
