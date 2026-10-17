import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDetails } from "@/components/shared/business-details";
import { LegalPage } from "@/components/shared/legal-page";
import { OPERATOR, SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

// TEMPLATE: have this policy reviewed (including DPDP Act 2023 obligations) before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="17 October 2026">
      <p>
        This policy explains what personal data {OPERATOR} collects through the {SITE_NAME} website and app, why we use
        it, who we share it with, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and a securely hashed password if you set one.</li>
        <li>
          Purchase records: orders, amounts and payment references. Card, UPI and bank details are entered on Razorpay&apos;s
          checkout and are never stored by us.
        </li>
        <li>Reading data: your reading progress and bookmarks, so you can continue where you left off.</li>
        <li>
          Affiliate data: for affiliates, the details in your application and the payout details you provide (stored
          encrypted). When a visitor arrives through an affiliate link we store a referral cookie and a one-way hash of
          their IP address.
        </li>
        <li>Technical data: basic logs such as IP address and browser type, used for security and to fix problems.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To deliver your purchases and keep your library, progress and bookmarks in sync.</li>
        <li>To secure your account and prevent fraud and misuse, including the personal watermark on your eBooks.</li>
        <li>To send transactional emails: receipts, sign-in links, verification and password resets.</li>
        <li>To credit affiliates for the sales they refer and to pay them.</li>
      </ul>
      <p>We do not sell your personal data and we do not send marketing emails without your consent.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Razorpay, to process payments and refunds.</li>
        <li>Our hosting, database, file storage and email providers, only as needed to run the Service.</li>
        <li>Authorities, when required by law.</li>
      </ul>

      <h2>Cookies and local storage</h2>
      <ul>
        <li>A strictly necessary session cookie keeps you signed in.</li>
        <li>A referral cookie (up to 30 days) credits affiliates for sales they referred.</li>
        <li>Preference cookies and local storage remember your language, theme and reader settings.</li>
      </ul>
      <p>We do not use advertising or third-party tracking cookies.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and purchase records while your account is active and as long as needed for accounting,
        tax and legal obligations. You can ask us to delete your account at any time.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your personal data, or withdraw consent, by writing to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We may need to verify your identity first.
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over HTTPS, passwords are hashed, payout details are encrypted, and eBook files are kept in private
        storage. No system is perfectly secure, but we work to protect your data.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>

      <h2>Grievances and contact</h2>
      <p>
        For privacy questions or complaints, see our <Link href="/contact">contact page</Link> or write to:
      </p>
      <BusinessDetails />
    </LegalPage>
  );
}
