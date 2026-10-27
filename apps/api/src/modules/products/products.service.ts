import { Types } from 'mongoose';
import { slugify, type AdminProduct, type ProductDetail, type ProductInputParsed, type ProductSummary } from '@ebook/shared';
import { conflict } from '../../lib/errors';
import { Product, type ProductDoc } from '../../models/Product';
import { ProductAsset } from '../../models/ProductAsset';

const API = '/api/v1';

export function publicCoverUrl(p: ProductDoc): string | null {
  return p.coverAssetId ? `${API}/products/${p.slug}/cover?v=${p.coverAssetId.toString()}` : null;
}

export function adminCoverUrl(p: ProductDoc): string | null {
  return p.coverAssetId ? `${API}/admin/products/${p._id.toString()}/cover?v=${p.coverAssetId.toString()}` : null;
}

function discountPercent(p: ProductDoc): number {
  if (p.salePricePaise == null || p.salePricePaise >= p.pricePaise) return 0;
  return Math.round((1 - p.salePricePaise / p.pricePaise) * 100);
}

export function toSummary(p: ProductDoc): ProductSummary {
  return {
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle ?? '',
    author: p.author ?? '',
    categories: p.categories,
    pricePaise: p.pricePaise,
    salePricePaise: p.salePricePaise ?? null,
    effectivePricePaise: p.effectivePricePaise,
    discountPercent: discountPercent(p),
    comboPricePaise: p.comboPricePaise ?? null,
    intlPriceCents: p.intlPriceCents ?? null,
    intlComboPriceCents: p.intlComboPriceCents ?? null,
    featured: p.featured,
    coverUrl: publicCoverUrl(p),
    pageCount: p.pageCount,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    kind: p.kind ?? 'book',
    membershipDays: p.kind === 'membership' ? (p.membership?.durationDays ?? null) : null,
    includedInMembership: p.kind !== 'membership' && p.includedInMembership !== false,
  };
}

export function toDetail(p: ProductDoc, addOns: ProductDoc[] = []): ProductDetail {
  return {
    ...toSummary(p),
    description: p.description ?? '',
    benefits: p.benefits,
    language: p.language ?? 'English',
    toc: p.toc.map((t) => ({ title: t.title ?? '', page: t.page ?? 1 })),
    addOns: addOns.map(toSummary),
  };
}

/** Everything that must be true before a product can go live. */
export function publishBlockers(p: ProductDoc): string[] {
  const blockers: string[] = [];
  if (!p.coverAssetId) blockers.push('Upload a cover image');
  if (!p.pageSetId || p.pageCount < 1) {
    blockers.push(p.processing?.status === 'failed' ? 'PDF processing failed — upload the PDF again' : 'Upload the eBook PDF and wait for processing to finish');
  }
  if (!p.description?.trim()) blockers.push('Add a description');
  if (p.pricePaise < 100) blockers.push('Set a price of at least ₹1');
  return blockers;
}

export async function toAdmin(p: ProductDoc): Promise<AdminProduct> {
  const pdf = p.pdfAssetId ? await ProductAsset.findById(p.pdfAssetId).lean() : null;
  return {
    id: p._id.toString(),
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle ?? '',
    author: p.author ?? '',
    description: p.description ?? '',
    benefits: p.benefits,
    categories: p.categories,
    language: p.language ?? 'English',
    pricePaise: p.pricePaise,
    salePricePaise: p.salePricePaise ?? null,
    effectivePricePaise: p.effectivePricePaise,
    comboPricePaise: p.comboPricePaise ?? null,
    intlPriceCents: p.intlPriceCents ?? null,
    intlComboPriceCents: p.intlComboPriceCents ?? null,
    status: p.status,
    featured: p.featured,
    includedInMembership: p.includedInMembership !== false,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    affiliate: {
      enabled: p.affiliate?.enabled ?? true,
      type: p.affiliate?.type ?? 'percent',
      value: p.affiliate?.value ?? 0,
    },
    pageCount: p.pageCount,
    toc: p.toc.map((t) => ({ title: t.title ?? '', page: t.page ?? 1 })),
    previewPages: p.previewPages,
    coverUrl: adminCoverUrl(p),
    pdf: pdf
      ? { filename: pdf.originalFilename ?? 'ebook.pdf', sizeBytes: pdf.sizeBytes, uploadedAt: pdf.createdAt.toISOString() }
      : null,
    processing: {
      status: p.processing?.status ?? 'none',
      error: p.processing?.error ?? null,
      done: p.processing?.done ?? 0,
      total: p.processing?.total ?? 0,
    },
    publishBlockers: publishBlockers(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Slugs that collide with fixed routes such as /checkout/success. */
const RESERVED_SLUGS = new Set(['success', 'new', 'by-slug']);

/** Picks a free slug: the requested one must be free; a generated one gets a numeric suffix if taken. */
export async function resolveSlug(title: string, requested: string | undefined, excludeId?: Types.ObjectId): Promise<string> {
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};
  if (requested && RESERVED_SLUGS.has(requested)) throw conflict('This URL slug is reserved. Please choose another.');
  if (requested) {
    if (await Product.exists({ slug: requested, ...notSelf })) throw conflict('Another eBook already uses this URL slug');
    return requested;
  }
  const base = slugify(title) || 'ebook';
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    if (!(await Product.exists({ slug: candidate, ...notSelf }))) return candidate;
  }
  return `${base}-${new Types.ObjectId().toString().slice(-6)}`;
}

/** Fields an admin may set directly. Status, assets and processing state have dedicated endpoints. */
export function applyInput(p: ProductDoc, input: ProductInputParsed): void {
  p.title = input.title;
  p.subtitle = input.subtitle;
  p.author = input.author;
  p.description = input.description;
  p.benefits = input.benefits;
  p.categories = [...new Set(input.categories)];
  p.language = input.language;
  p.pricePaise = input.pricePaise;
  p.salePricePaise = input.salePricePaise;
  p.comboPricePaise = input.comboPricePaise;
  p.intlPriceCents = input.intlPriceCents;
  p.intlComboPriceCents = input.intlComboPriceCents;
  p.featured = input.featured;
  p.includedInMembership = input.includedInMembership;
  p.set('affiliate', input.affiliate);
  p.previewPages = [...new Set(input.previewPages)].sort((a, b) => a - b);
  p.set('toc', input.toc);
}
