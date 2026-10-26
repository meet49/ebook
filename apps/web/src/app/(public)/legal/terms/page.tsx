import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDetails } from "@/components/shared/business-details";
import { LegalPage } from "@/components/shared/legal-page";
import { BUSINESS, OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Terms & conditions", alternates: { canonical: "/legal/terms" } };

// TEMPLATE: have these terms reviewed by a qualified lawyer before launch (see docs/DEPLOYMENT.md).
export default function TermsPage() {
  return (
    <LegalPage title="Terms & conditions" updated="17 October 2026">
      <p>
        These terms govern your use of the {SITE_NAME} website and app (the &ldquo;Service&rdquo;), provided by {OPERATOR}
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;), and your purchase of digital eBooks through it. By creating an account or
        making a purchase you agree to these terms, our <Link href="/legal/privacy">privacy policy</Link> and our{" "}
        <Link href="/legal/refunds">cancellation &amp; refund policy</Link>.
      </p>

      <h2>The Service</h2>
      <p>
        {SITE_NAME} sells digital eBooks that you read online in the {SITE_NAME} reader on your phone, tablet or computer.
        We do not sell or ship physical goods. Delivery is explained in our{" "}
        <Link href="/legal/delivery">shipping &amp; delivery policy</Link>.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must give a valid email address. You are responsible for activity on your account.</li>
        <li>Do not share your password or one-time sign-in links. Tell us immediately if you think your account is misused.</li>
        <li>You must be at least 18, or use the Service with the involvement of a parent or guardian.</li>
      </ul>

      <h2>Your licence</h2>
      <p>
        When you buy an eBook you receive a personal, non-transferable, non-exclusive licence to read it through our
        online reader for your own non-commercial use. You do not acquire ownership of the content or a downloadable
        file. Each copy is personalised with your email address.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not copy, redistribute, resell or publicly post any part of an eBook.</li>
        <li>Do not attempt to bypass access controls, rate limits or watermarks, or extract files from the reader.</li>
        <li>Do not use the Service for anything unlawful or to harm other users or the Service.</li>
      </ul>
      <p>We may suspend or close accounts involved in misuse. Watermarks help us trace unauthorised distribution.</p>

      <h2>Prices and payments</h2>
      <ul>
        <li>Prices are shown in Indian Rupees (INR) on each eBook&apos;s page, and the amount you pay is shown at checkout before you pay.</li>
        <li>
          Visitors outside India may see prices in US dollars (USD). These are charged in Indian Rupees at the day&apos;s
          exchange rate, which is shown at checkout; your bank may add its own conversion fee.
        </li>
        <li>
          Payments are processed securely by Razorpay (UPI, cards, netbanking and wallets). We do not see or store your
          card or UPI details.
        </li>
        <li>Your eBook is made available only after the payment is verified.</li>
        <li>We may change prices at any time. Changes never affect orders you have already paid for.</li>
      </ul>

      <h2>Cancellations and refunds</h2>
      <p>
        Because eBooks are delivered instantly, orders cannot be cancelled once delivered. Refunds are covered by our{" "}
        <Link href="/legal/refunds">cancellation &amp; refund policy</Link>.
      </p>

      <h2>Affiliate program</h2>
      <p>
        Affiliates are additionally bound by the program rules on the <Link href="/affiliates">affiliate program</Link>{" "}
        page. Commissions are earned only on verified sales and may be reversed for refunds or fraud. Payouts are made
        manually after review to the payout details the affiliate provides.
      </p>

      <h2>Intellectual property</h2>
      <p>
        eBooks belong to their authors and publishers. The {SITE_NAME} name, logo, website and reader belong to us. Nothing
        in these terms transfers these rights to you.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep the Service available but cannot promise it will always be uninterrupted or error-free. To the
        extent permitted by law, our total liability for any claim relating to a purchase is limited to the amount you
        paid for that purchase.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top shows the latest version. Continuing to use the Service after a
        change means you accept the updated terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts of{" "}
        {BUSINESS.jurisdiction || "India"}.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? See our <Link href="/contact">contact page</Link> or write to us:
      </p>
      <BusinessDetails />
    </LegalPage>
  );
}
