import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Link2, LineChart, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Affiliate program",
  description: "Promote eBooks with your own referral links and earn commission on verified sales.",
};

const FEATURES = [
  { icon: Link2, title: "A link for every book", body: "Generate a unique referral link for each eligible eBook and share it anywhere." },
  { icon: LineChart, title: "Real-time tracking", body: "See clicks, verified sales and conversion rates in your dashboard." },
  { icon: Wallet, title: "Clear payouts", body: "Commissions move from pending to payable after the refund window. Request a payout any time." },
];

const RULES = [
  "Commission is earned only on verified, paid orders — never on clicks alone.",
  "Attribution lasts 30 days from the visitor's most recent click on an affiliate link (last click wins).",
  "The commission rate is set per eBook and shown before you promote it.",
  "Refunded orders reverse the related commission.",
  "Self-referrals (buying through your own link) are not eligible.",
  "Payouts are reviewed and paid manually to your registered UPI ID or bank account.",
];

export default function AffiliatesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Share books you believe in. <span className="text-gradient-brand">Get paid for every sale.</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          Join our affiliate program and earn a commission when your audience buys through your links.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/affiliate/apply">Apply now</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/affiliate/login">Affiliate sign in</Link>
          </Button>
        </div>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="shadow-none">
            <CardContent className="space-y-3">
              <span className="bg-accent text-accent-foreground inline-flex size-10 items-center justify-center rounded-xl">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-14 max-w-3xl rounded-2xl border p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Program rules</h2>
        <ul className="mt-4 space-y-3">
          {RULES.map((r) => (
            <li key={r} className="flex gap-3 text-sm">
              <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-6 text-xs">
          Example: on a ₹1,000 eBook with a 20% commission, you earn ₹200 once the sale is verified and the refund
          window has passed.
        </p>
      </div>
    </div>
  );
}
