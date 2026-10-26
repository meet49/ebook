import "server-only";
import { cookies, headers } from "next/headers";
import { COUNTRY_COOKIE, isInternationalCountry } from "./region";

/** The visitor's country: Vercel's geo header, else the remembered cookie, else India. */
export async function getCountry(): Promise<string> {
  const header = (await headers()).get("x-vercel-ip-country");
  const raw = header || (await cookies()).get(COUNTRY_COOKIE)?.value || "IN";
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "IN";
}

export async function isInternationalVisitor(): Promise<boolean> {
  return isInternationalCountry(await getCountry());
}
