import type { CommissionType, ProductStatus, Role, UserStatus } from './enums';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: UserStatus;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TocEntry {
  title: string;
  page: number;
}

/** Product card data for the public marketplace. Never includes storage keys or commission settings. */
export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  categories: string[];
  pricePaise: number;
  salePricePaise: number | null;
  /** What checkout will charge. */
  effectivePricePaise: number;
  discountPercent: number;
  featured: boolean;
  coverUrl: string | null;
  pageCount: number;
  publishedAt: string | null;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  benefits: string[];
  language: string;
  toc: TocEntry[];
  /** Public sample page image URLs, in page order. */
  samples: { page: number; url: string }[];
}

export type ProcessingStatus = 'none' | 'queued' | 'processing' | 'ready' | 'failed';

export interface AdminProduct {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  benefits: string[];
  categories: string[];
  language: string;
  pricePaise: number;
  salePricePaise: number | null;
  effectivePricePaise: number;
  status: ProductStatus;
  featured: boolean;
  publishedAt: string | null;
  affiliate: { enabled: boolean; type: CommissionType; value: number };
  pageCount: number;
  toc: TocEntry[];
  previewPages: number[];
  coverUrl: string | null;
  pdf: { filename: string; sizeBytes: number; uploadedAt: string } | null;
  processing: { status: ProcessingStatus; error: string | null; done: number; total: number };
  /** Requirements not yet met for publishing (empty when publishable). */
  publishBlockers: string[];
  createdAt: string;
  updatedAt: string;
}
