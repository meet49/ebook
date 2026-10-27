import { COUPON_CODE } from "@ebook/shared";

/** Set by the proxy from a shared link (?coupon=CODE) so the code is filled in at checkout. */
export const COUPON_COOKIE = "rns_coupon";

/** The coupon code in a query or cookie value, uppercased, when it looks valid. */
export function couponFrom(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return COUPON_CODE.test(code) ? code : undefined;
}

export function forgetCoupon() {
  document.cookie = `${COUPON_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
}
