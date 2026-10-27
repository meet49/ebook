export const ROLES = ['customer', 'affiliate', 'author', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Each login screen is bound to one role. */
export const PORTALS = ['customer', 'affiliate', 'author', 'admin'] as const;
export type Portal = (typeof PORTALS)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** in_review: an author's book waiting for an admin to publish it or ask for changes. */
export const PRODUCT_STATUSES = ['draft', 'in_review', 'published', 'unpublished', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const COMMISSION_TYPES = ['percent', 'fixed'] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const ASSET_KINDS = ['original_pdf', 'cover', 'page_image'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const AFFILIATE_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

export const AUTHOR_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type AuthorStatus = (typeof AUTHOR_STATUSES)[number];

/** pending: in the refund hold · payable: owed · paid · reversed: refunded before payment. */
export const AUTHOR_EARNING_STATUSES = ['pending', 'payable', 'paid', 'reversed'] as const;
export type AuthorEarningStatus = (typeof AUTHOR_EARNING_STATUSES)[number];

export const ORDER_STATUSES = [
  'created',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ATTRIBUTION_TYPES = ['affiliate', 'direct'] as const;
export type AttributionType = (typeof ATTRIBUTION_TYPES)[number];

export const ENTITLEMENT_STATUSES = ['active', 'revoked'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const COMMISSION_STATUSES = [
  'pending',
  'approved',
  'payable',
  'processing',
  'paid',
  'reversed',
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const PAYOUT_STATUSES = ['requested', 'processing', 'paid', 'rejected'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYMENT_EVENT_STATUSES = ['received', 'processed', 'ignored', 'failed'] as const;
export type PaymentEventStatus = (typeof PAYMENT_EVENT_STATUSES)[number];

export const AUTH_TOKEN_PURPOSES = ['verify_email', 'reset_password', 'magic_login'] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

export const COUPON_TYPES = ['percent', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

/** What a coupon discounts: every book, the chosen books, membership passes, or everything. */
export const COUPON_SCOPES = ['books', 'selected', 'membership', 'all'] as const;
export type CouponScope = (typeof COUPON_SCOPES)[number];

/** A catalogue item is an eBook or a membership pass (an all-access plan). */
export const PRODUCT_KINDS = ['book', 'membership'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
