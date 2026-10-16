import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of service" };

// TEMPLATE: have these terms reviewed by a qualified lawyer before launch (see docs/DEPLOYMENT.md).
export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="16 October 2026">
      <p>
        These terms govern your use of {SITE_NAME} and your purchase of digital eBooks. By creating an account or making
        a purchase you agree to them.
      </p>
      <h2>Your licence</h2>
      <p>
        When you buy an eBook you receive a personal, non-transferable, non-exclusive licence to read it through our
        online reader for your own non-commercial use. You do not acquire ownership of the content.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not share your account or sign-in links with others.</li>
        <li>Do not copy, redistribute, resell or publicly post any part of an eBook.</li>
        <li>Do not attempt to bypass access controls, rate limits or watermarks.</li>
      </ul>
      <p>We may suspend accounts involved in misuse. Pages are watermarked to help trace unauthorised distribution.</p>
      <h2>Payments</h2>
      <p>
        Payments are processed by Razorpay. Prices are shown in Indian Rupees. Access is granted only after the payment
        is verified.
      </p>
      <h2>Affiliates</h2>
      <p>
        Affiliates are additionally bound by the program rules published on the affiliate program page. Commissions are
        earned only on verified sales and may be reversed for refunds or fraud.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms: {SUPPORT_EMAIL}.</p>
    </LegalPage>
  );
}
