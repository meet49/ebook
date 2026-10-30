import type { MetadataRoute } from "next";
import { connection } from "next/server";
import type { ProductSummary } from "@ebook/shared";
import { absoluteUrl } from "@/lib/seo";
import { getCatalog, getCategories } from "@/lib/server-api";

const PAGE_SIZE = 48;

async function allPublishedBooks(): Promise<ProductSummary[]> {
  const books: ProductSummary[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await getCatalog({ sort: "newest", page, pageSize: PAGE_SIZE });
    books.push(...res.items);
    if (books.length >= res.total || res.items.length === 0) break;
  }
  return books;
}

/**
 * Built on request, never during a deploy (the API may be asleep or unreachable then). Its catalog
 * requests are cached for 30 seconds, and newly published books appear without a redeploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [books, categories] = await Promise.all([allPublishedBooks().catch(() => []), getCategories().catch(() => [])]);
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/ebooks"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/membership"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/affiliates"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/authors"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/author/apply"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/affiliate/apply"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/legal/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/legal/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/legal/refunds"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/legal/delivery"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: absoluteUrl(`/ebooks?category=${encodeURIComponent(c)}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const bookPages: MetadataRoute.Sitemap = books.map((b) => ({
    url: absoluteUrl(`/ebooks/${b.slug}`),
    lastModified: b.publishedAt ? new Date(b.publishedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
    images: b.coverUrl ? [absoluteUrl(b.coverUrl)] : undefined,
  }));

  return [...pages, ...categoryPages, ...bookPages];
}
