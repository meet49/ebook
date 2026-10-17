import { BUSINESS, SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";

/** Who operates the store and how to reach them, for the end of policy pages. */
export function BusinessDetails() {
  return (
    <address className="bg-muted/40 text-foreground not-italic rounded-2xl border p-5 text-[0.95rem] leading-7">
      <strong>{BUSINESS.legalName || SITE_NAME}</strong>
      {BUSINESS.legalName ? <span className="text-muted-foreground"> (operating {SITE_NAME})</span> : null}
      {BUSINESS.address ? <span className="block">{BUSINESS.address}</span> : null}
      <span className="block">
        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </span>
      {BUSINESS.phone ? (
        <span className="block">
          Phone: <a href={`tel:${BUSINESS.phone.replace(/[^\d+]/g, "")}`}>{BUSINESS.phone}</a>
        </span>
      ) : null}
    </address>
  );
}
