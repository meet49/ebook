"use client";

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  theme: { color: string };
  handler: (res: RazorpaySuccess) => void;
  modal: { ondismiss: () => void; confirm_close?: boolean };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (res: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export function openRazorpay(options: Omit<RazorpayOptions, "theme">, onFailed: (message: string) => void): void {
  if (!window.Razorpay) throw new Error("Payment window not loaded");
  const rzp = new window.Razorpay({ ...options, theme: { color: "#4f46e5" } });
  rzp.on("payment.failed", (res) => onFailed(res.error.description ?? "Payment failed"));
  rzp.open();
}
