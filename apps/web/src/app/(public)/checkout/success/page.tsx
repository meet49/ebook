import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).checkout.metaConfirmation, robots: { index: false } };
}

export default function CheckoutSuccessPage() {
  return (
    <div className="relative isolate flex flex-1">
      <div aria-hidden className="bg-primary/10 absolute top-10 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12 sm:py-16">
        <Suspense>
          <OrderConfirmation />
        </Suspense>
      </div>
    </div>
  );
}
