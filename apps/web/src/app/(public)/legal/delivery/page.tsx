import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDetails } from "@/components/shared/business-details";
import { LegalPage } from "@/components/shared/legal-page";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Shipping & delivery policy", alternates: { canonical: "/legal/delivery" } };

// TEMPLATE: confirm with the business owner before launch.
export default function DeliveryPage() {
  return (
    <LegalPage title="Shipping & delivery policy" updated="17 October 2026">
      <p>
        {SITE_NAME} sells digital eBooks only. Nothing is shipped, so there are no shipping charges and no physical
        delivery address is needed.
      </p>
      <h2>How you receive your eBook</h2>
      <ul>
        <li>After you pay through Razorpay, we verify the payment with Razorpay.</li>
        <li>As soon as the payment is verified, the eBook is added to your library on {SITE_NAME}, usually within seconds.</li>
        <li>
          We also email you a confirmation. If you checked out without signing in, the email includes a one-time sign-in
          link to your library.
        </li>
        <li>
          You read the eBook online in the {SITE_NAME} reader on any phone, tablet or computer. The eBook is not delivered
          as a downloadable file.
        </li>
      </ul>
      <h2>Delivery time and charges</h2>
      <ul>
        <li>Delivery time: instant after payment verification. There is no shipping period.</li>
        <li>Delivery charges: none.</li>
        <li>Delivery area: available wherever the website can be opened; payments are accepted in Indian Rupees.</li>
      </ul>
      <h2>If your eBook does not appear</h2>
      <p>
        Some payment methods take a little longer to confirm. If your book is not in your library within 30 minutes of a
        successful payment, write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order number and
        the email address you used at checkout. If a payment fails, no eBook is delivered and any amount deducted is
        handled as described in our <Link href="/legal/refunds">refund policy</Link>.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about delivery? See our <Link href="/contact">contact page</Link> or write to:
      </p>
      <BusinessDetails />
    </LegalPage>
  );
}
