import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  CreditCard,
  Fingerprint,
  Library,
  Link2,
  MousePointerClick,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { EarningsCalculator } from "@/components/home/earnings-calculator";
import { FeaturedEbooks } from "@/components/home/featured-ebooks";
import { Hero } from "@/components/home/hero";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: MousePointerClick, title: "Choose your book", body: "Browse the collection and read real sample pages before you buy." },
  { icon: CreditCard, title: "Pay in seconds", body: "UPI, cards, netbanking or wallets through Razorpay. No account needed upfront." },
  { icon: Library, title: "Start reading", body: "The book lands in your library the moment payment is verified — plus a sign-in link by email." },
];

const FAQ = [
  {
    q: "How do I access my eBook after buying?",
    a: "As soon as your payment is verified, the book is added to your personal library. We also email you a secure one-time sign-in link, so you can start reading even if you checked out as a guest.",
  },
  {
    q: "Do I need to create an account first?",
    a: "No. Just enter your name and email at checkout. We create your library for you, and you can set a password later from account settings.",
  },
  {
    q: "Can I download the PDF?",
    a: "Books are read in our online reader on any device. This keeps your progress and bookmarks in sync and protects the authors' work. Pages are personalised to your account.",
  },
  {
    q: "Which payment methods are supported?",
    a: "UPI, debit and credit cards, netbanking and popular wallets — all processed securely by Razorpay. We never see or store your card details.",
  },
  {
    q: "What if something goes wrong with my purchase?",
    a: "If you were charged twice or can't access your book, write to us with your order number and we'll fix it or refund you. See our refund policy for details.",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <FeaturedEbooks />

      {/* Feature bento */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">Made for readers</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything you need to actually <span className="font-display font-normal italic">finish</span> the book
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-6 md:grid-rows-2">
          <div className="from-accent/70 relative overflow-hidden rounded-3xl border bg-linear-to-br to-white p-7 md:col-span-4 md:row-span-1">
            <BookOpenCheck className="text-primary size-7" aria-hidden />
            <h3 className="mt-4 text-xl font-semibold">A reader that feels like a book</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              Realistic page turns, two-page spreads on larger screens, swipe on mobile, full-screen mode and a comfortable
              dark theme for night reading.
            </p>
            <div aria-hidden className="absolute -right-6 -bottom-10 hidden h-40 w-64 rotate-[-8deg] rounded-xl border bg-white shadow-xl sm:block">
              <div className="flex h-full">
                <div className="flex-1 space-y-2 p-4">
                  {[90, 100, 80, 95, 70].map((w, i) => (
                    <div key={i} className="h-1.5 rounded-full bg-neutral-200" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <div className="w-px bg-neutral-200" />
                <div className="flex-1 space-y-2 p-4">
                  {[100, 85, 92, 60].map((w, i) => (
                    <div key={i} className="h-1.5 rounded-full bg-neutral-200" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <Feature className="md:col-span-2" icon={Smartphone} title="Any device" body="Phone, tablet or laptop — open your library in the browser. Nothing to install." />
          <Feature className="md:col-span-2" icon={BookMarked} title="Bookmarks & progress" body="Pick up exactly where you left off, on any device." />
          <Feature className="md:col-span-2" icon={ShieldCheck} title="Secure payments" body="Razorpay-powered checkout with UPI, cards and netbanking." />
          <Feature className="md:col-span-2" icon={Fingerprint} title="Personal copies" body="Every page is licensed to you — your library stays private to your account." />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold tracking-wide uppercase">How it works</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">From checkout to chapter one in under a minute</h2>
          </div>
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            <div aria-hidden className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-indigo-300 to-transparent md:block" />
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative flex flex-col items-center text-center">
                <span className="bg-background ring-primary/15 relative flex size-14 items-center justify-center rounded-2xl border shadow-sm ring-4">
                  <Icon className="text-primary size-6" aria-hidden />
                  <span className="bg-gradient-brand absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Affiliate */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,oklch(0.32_0.15_277),oklch(0.42_0.22_285)_55%,oklch(0.48_0.24_300))] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div aria-hidden className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <Link2 className="size-3.5" aria-hidden /> Affiliate program
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Recommend books you love. <span className="font-display font-normal italic">Get paid</span> for every sale.
              </h2>
              <ul className="space-y-3 text-white/85">
                {[
                  { icon: Link2, text: "A unique referral link for every eBook" },
                  { icon: RefreshCcw, text: "30-day attribution — they can buy later and you still earn" },
                  { icon: Wallet, text: "Clear commission ledger and payouts to UPI or bank" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary" className="h-12 px-6">
                  <Link href="/affiliate/apply">
                    Apply now <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/affiliates">Program details</Link>
                </Button>
              </div>
            </div>
            <EarningsCalculator />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">FAQ</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Questions, answered</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group bg-background rounded-2xl border px-5 py-4 transition-shadow open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden">
                {f.q}
                <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your next favourite book is <span className="font-display text-gradient-brand font-normal italic">one click</span> away.
          </h2>
          <p className="text-muted-foreground max-w-xl">Read a free sample of any title — no account needed.</p>
          <Button asChild size="lg" className="shadow-primary/25 h-12 px-7 text-base shadow-lg">
            <Link href="/ebooks">
              Explore eBooks <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`bg-background rounded-3xl border p-6 transition-shadow hover:shadow-md ${className ?? ""}`}>
      <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
