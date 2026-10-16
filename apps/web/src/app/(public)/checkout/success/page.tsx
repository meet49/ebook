import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-16">
      <Suspense>
        <OrderConfirmation />
      </Suspense>
    </div>
  );
}
