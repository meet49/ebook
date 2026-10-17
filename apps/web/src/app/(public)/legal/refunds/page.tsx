import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDetails } from "@/components/shared/business-details";
import { LegalPage } from "@/components/shared/legal-page";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Cancellation & refund policy" };

// TEMPLATE: confirm the refund window and conditions with the business owner before launch.
export default function RefundsPage() {
  return (
    <LegalPage title="Cancellation & refund policy" updated="17 October 2026">
      <p>
        {SITE_NAME} sells digital eBooks that are delivered to your online library as soon as your payment is verified.
        This policy explains when an order can be cancelled and when we give refunds.
      </p>

      <h2>Cancellation</h2>
      <ul>
        <li>
          Because delivery is instant, an order cannot be cancelled once the payment is verified and the eBook is in your
          library.
        </li>
        <li>
          If you close the payment window or the payment fails, the order is not completed and nothing is charged by us.
          You can simply try again.
        </li>
      </ul>

      <h2>When we refund</h2>
      <ul>
        <li>You were charged more than once for the same eBook.</li>
        <li>Money was deducted but the order failed and the eBook was not delivered.</li>
        <li>A technical problem on our side prevents you from reading the eBook and we cannot fix it.</li>
        <li>The eBook is materially different from its description on the store.</li>
      </ul>
      <p>
        Because eBooks can be read immediately, we do not offer refunds simply for change of mind after the eBook has been
        delivered.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 7 days of your purchase with your order
        number, the email address you used at checkout and a short description of the problem. We reply by email after
        reviewing your request.
      </p>

      <h2>How refunds are paid</h2>
      <ul>
        <li>Approved refunds are made through Razorpay to the original payment method (UPI, card, netbanking or wallet).</li>
        <li>
          After we approve a refund, it usually reaches your account within 5–7 working days, depending on your bank or
          payment provider.
        </li>
        <li>
          If a failed payment was deducted from your account, it is usually reversed automatically by your bank within the
          same time. If it is not, contact us with the payment details.
        </li>
        <li>Access to a refunded eBook is removed from your library.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        See our <Link href="/contact">contact page</Link> or write to:
      </p>
      <BusinessDetails />
    </LegalPage>
  );
}
