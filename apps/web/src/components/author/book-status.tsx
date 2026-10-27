"use client";

import type { ProductStatus } from "@ebook/shared";
import { StatusPill, type PillTone } from "@/components/dashboard/list-ui";
import { useMessages } from "@/i18n/client";

const TONE: Record<ProductStatus, PillTone> = {
  draft: "muted",
  in_review: "primary",
  published: "success",
  unpublished: "warning",
  archived: "muted",
};

/** An author's book status in their own words ("Live", "In review", "Out of store"…). */
export function AuthorBookStatus({ status }: { status: ProductStatus }) {
  const t = useMessages().author.overview.status;
  return <StatusPill tone={TONE[status]}>{t[status] ?? status}</StatusPill>;
}
