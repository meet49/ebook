import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "ebook_sid";

/**
 * Optimistic redirect for signed-out visitors on protected pages, so they land on the
 * right sign-in screen without a flash of dashboard UI. This only checks that a session
 * cookie exists — the API validates the session and role on every request.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const loginPath = pathname.startsWith("/admin")
    ? "/admin/login"
    : pathname.startsWith("/affiliate")
      ? "/affiliate/login"
      : "/login";

  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/library/:path*",
    "/account/:path*",
    "/read/:path*",
    "/admin",
    "/admin/((?!login).*)",
    "/affiliate",
    "/affiliate/((?!login|apply).*)",
  ],
};
