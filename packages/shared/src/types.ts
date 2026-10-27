import type { AuthorEarningStatus, AuthorStatus, CommissionType, ProductKind, ProductStatus, Role, UserStatus } from './enums';

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
  /** Price when bought together with another book of the same category; null when not offered. */
  comboPricePaise: number | null;
  /** Price for visitors outside India, in US cents; null shows the INR price everywhere. */
  intlPriceCents: number | null;
  /** International combo price in US cents (null: derived from the INR combo discount). */
  intlComboPriceCents: number | null;
  featured: boolean;
  coverUrl: string | null;
  pageCount: number;
  publishedAt: string | null;
  /** A book, or a membership plan (sold through the same checkout). */
  kind: ProductKind;
  /** Plans only: days one pass lasts. */
  membershipDays: number | null;
  /** Books only: members can read it. */
  includedInMembership: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  benefits: string[];
  language: string;
  toc: TocEntry[];
  /** Same-category books that can be added at their combo price when buying this one. */
  addOns: ProductSummary[];
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
  comboPricePaise: number | null;
  intlPriceCents: number | null;
  intlComboPriceCents: number | null;
  status: ProductStatus;
  featured: boolean;
  includedInMembership: boolean;
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
  /** Set for books written by a marketplace author. */
  authorProfile: { id: string; penName: string } | null;
  /** The admin's note when they asked the author for changes. */
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One book in an order. Orders made before combos have exactly one line. */
export interface OrderLine {
  title: string;
  slug: string;
  /** What the book costs on its own at order time. */
  listPricePaise: number;
  /** What was charged for it in this order. */
  pricePaise: number;
  /** True when the combo price was applied. */
  combo: boolean;
}

/** An order line with what to show the buyer (in the display currency's minor unit). */
export interface QuoteLine extends OrderLine {
  displayListMinor: number;
  displayPriceMinor: number;
  /** Coupon discount already taken off displayPriceMinor. */
  couponDisplayMinor?: number;
}

/** Server-calculated price breakdown shown before payment. */
export interface CheckoutQuote {
  lines: QuoteLine[];
  /** Always charged in INR (paise). */
  totalPaise: number;
  savingsPaise: number;
  /** What the buyer sees prices in: USD for international visitors when every book has a USD price. */
  currency: 'INR' | 'USD';
  totalDisplayMinor: number;
  savingsDisplayMinor: number;
  /** INR per USD used to convert, when the currency is USD. */
  fxRate: number | null;
  /** The applied coupon, when one was entered and is valid. */
  coupon: { code: string; discountPaise: number; discountDisplayMinor: number } | null;
  /** Why an entered coupon was not applied (shown next to the field). */
  couponError: string | null;
  /** Books that can still be added to this order at their combo price. */
  addOns: ProductSummary[];
  /** Set when a post-purchase combo price applies to the main book. */
  offerExpiresAt: string | null;
}

/** Combo offers available for a limited time after a purchase. */
export interface ComboOffers {
  expiresAt: string | null;
  items: ProductSummary[];
}

export interface AdminCoupon {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  percentOff: number | null;
  amountOffPaise: number | null;
  appliesTo: 'books' | 'selected' | 'membership' | 'all';
  productIds: string[];
  minOrderPaise: number;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  affiliateCode: string | null;
  /** Paid orders that used it, and the total discount given. */
  uses: number;
  discountPaise: number;
  createdAt: string;
}

/** A membership plan on the public membership page. */
export interface MembershipPlan {
  id: string;
  slug: string;
  title: string;
  description: string;
  benefits: string[];
  durationDays: number;
  pricePaise: number;
  salePricePaise: number | null;
  effectivePricePaise: number;
  discountPercent: number;
  intlPriceCents: number | null;
  featured: boolean;
}

export interface MembershipOverview {
  plans: MembershipPlan[];
  /** Published books members can read, and a few of them to show. */
  bookCount: number;
  books: ProductSummary[];
}

export interface AdminMembershipPlan extends MembershipPlan {
  status: ProductStatus;
  affiliate: { enabled: boolean; type: CommissionType; value: number };
  /** Paid passes sold with this plan. */
  sold: number;
  createdAt: string;
}

export interface PayoutDestinationSummary {
  method: 'upi' | 'bank_transfer';
  upiId: string | null;
  accountName: string | null;
  accountNumberLast4: string | null;
  ifsc: string | null;
}

/** The signed-in author's own profile. */
export interface AuthorProfileDto {
  id: string;
  status: AuthorStatus;
  penName: string;
  bio: string;
  website: string;
  /** Share of each sale (after any affiliate commission), in percent. */
  sharePercent: number;
  payout: PayoutDestinationSummary | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AuthorStats {
  books: { total: number; published: number; inReview: number };
  sales: number;
  earnings: { pendingPaise: number; payablePaise: number; paidPaise: number };
}

export interface AuthorEarningDto {
  id: string;
  orderNumber: string;
  books: { title: string; pricePaise: number; amountPaise: number }[];
  amountPaise: number;
  status: AuthorEarningStatus;
  holdUntil: string;
  createdAt: string;
}

export interface AdminAuthor {
  id: string;
  status: AuthorStatus;
  penName: string;
  bio: string;
  website: string;
  aboutBooks: string;
  sharePercent: number;
  user: { name: string; email: string };
  books: number;
  payablePaise: number;
  paidPaise: number;
  hasPayoutDetails: boolean;
  reviewNote: string | null;
  createdAt: string;
}
