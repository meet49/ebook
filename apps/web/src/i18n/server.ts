import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { messages, type Messages } from "./messages";

/** The visitor's chosen language, else Hindi when the browser prefers it, else English. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("hi") ? "hi" : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()];
}
