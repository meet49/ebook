import type { Locale } from "../config";
import { about } from "./about";
import { affiliate } from "./affiliate";
import { affiliateProgram } from "./affiliateProgram";
import { auth } from "./auth";
import { catalog } from "./catalog";
import { checkout } from "./checkout";
import { common } from "./common";
import { contact } from "./contact";
import { home } from "./home";
import { library } from "./library";
import { membership } from "./membership";
import { product } from "./product";
import { reader } from "./reader";

/**
 * One file per area. Each exports `{ en, hi }`, where `hi` is typed as `typeof en`, so a
 * missing or misspelled Hindi string is a type error.
 */
const namespaces = { common, home, catalog, product, checkout, auth, library, reader, affiliateProgram, affiliate, contact, about, membership };

type Namespaces = typeof namespaces;
export type Messages = { [K in keyof Namespaces]: Namespaces[K]["en"] };

function build(locale: Locale): Messages {
  return Object.fromEntries(Object.entries(namespaces).map(([k, v]) => [k, v[locale]])) as Messages;
}

export const messages: Record<Locale, Messages> = { en: build("en"), hi: build("hi") };
