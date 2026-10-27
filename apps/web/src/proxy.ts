import { NextResponse, type NextRequest } from "next/server";
import { COUPON_COOKIE, couponFrom } from "@/lib/coupon";
import { COUNTRY_COOKIE } from "@/lib/region";

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "ebook_sid";

/** Pages that need a session; signed-out visitors are sent to the right sign-in screen. */
const PROTECTED = [/^\/library(\/|$)/, /^\/account(\/|$)/, /^\/read(\/|$)/, /^\/admin(?!\/login)(\/|$)/, /^\/affiliate(?!\/(login|apply))(\/|$)/, /^\/author(?!\/(login|apply))(\/|$)/];

/**
 * 1. Optimistic redirect for signed-out visitors on protected pages, so they land on the right
 *    sign-in screen without a flash of dashboard UI. This only checks that a session cookie
 *    exists — the API validates the session and role on every request.
 * 2. Remembers the visitor's country (from Vercel's geo header) in a cookie, so the API and the
 *    browser show international prices consistently.
 * 3. Remembers a coupon from a shared link (?coupon=CODE) for a week, for checkout.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!request.cookies.has(SESSION_COOKIE) && PROTECTED.some((rx) => rx.test(pathname))) {
    const loginPath = pathname.startsWith("/admin")
      ? "/admin/login"
      : pathname.startsWith("/affiliate")
        ? "/affiliate/login"
        : pathname.startsWith("/author")
          ? "/author/login"
          : "/login";
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country) && request.cookies.get(COUNTRY_COOKIE)?.value !== country) {
    res.cookies.set(COUNTRY_COOKIE, country, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  }
  const coupon = couponFrom(request.nextUrl.searchParams.get("coupon"));
  if (coupon) res.cookies.set(COUPON_COOKIE, coupon, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  return res;
}

export const config = {
  // Every page, but not the API, referral links, build assets or static files.
  matcher: ["/((?!api/|r/|_next/|icons/|pdfjs/|sw\\.js|manifest\\.webmanifest|favicon\\.ico|.*\\.[a-z0-9]+$).*)"],
};
