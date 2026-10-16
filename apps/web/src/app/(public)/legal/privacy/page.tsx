import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

// TEMPLATE: have this policy reviewed (including DPDP Act 2023 obligations) before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="16 October 2026">
      <p>This policy explains what {SITE_NAME} collects, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and a securely hashed password if you set one.</li>
        <li>Purchase records: orders, amounts and payment references. Card and UPI details are handled by Razorpay, not us.</li>
        <li>Reading data: your reading progress and bookmarks, so you can continue where you left off.</li>
        <li>Affiliate referrals: when you arrive through an affiliate link we store a cookie and a one-way hash of your IP address.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To deliver your purchases, secure your account, send transactional emails, attribute affiliate sales and
        prevent fraud. We do not sell your personal data.
      </p>
      <h2>Cookies</h2>
      <p>
        We use a strictly necessary session cookie to keep you signed in and a referral cookie (up to 30 days) to credit
        affiliates.
      </p>
      <h2>Your rights</h2>
      <p>You can request access to, correction of, or deletion of your data by writing to {SUPPORT_EMAIL}.</p>
    </LegalPage>
  );
}
