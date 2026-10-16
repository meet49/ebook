import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Refund policy" };

// TEMPLATE: confirm the refund window and conditions with the business owner before launch.
export default function RefundsPage() {
  return (
    <LegalPage title="Refund policy" updated="16 October 2026">
      <p>
        Because eBooks are delivered instantly, refunds are handled case by case. If something went wrong with your
        purchase, write to {SUPPORT_EMAIL} within 7 days with your order number.
      </p>
      <h2>When we refund</h2>
      <ul>
        <li>You were charged more than once for the same book.</li>
        <li>A technical problem on our side prevents you from reading the book and we cannot fix it.</li>
      </ul>
      <h2>What happens after a refund</h2>
      <p>
        Refunds are returned to the original payment method through Razorpay. Access to the refunded book is removed
        from your library.
      </p>
    </LegalPage>
  );
}
