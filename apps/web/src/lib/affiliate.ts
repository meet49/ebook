"use client";

import { useQuery } from "@tanstack/react-query";
import type { AffiliateStatus, CommissionStatus, CommissionType, PayoutStatus } from "@ebook/shared";
import { ApiError, api } from "./api";

export interface AffiliateProfileDto {
  id: string;
  code: string;
  status: AffiliateStatus;
  application: { website: string; channels: string[]; audienceSize: string; promotionPlan: string; submittedAt: string | null };
  payout: { method: "upi" | "bank_transfer"; upiId: string | null; accountName: string | null; accountNumberLast4: string | null; ifsc: string | null } | null;
  reviewNote: string | null;
  createdAt: string;
}

/** A coupon code the admin gave the affiliate; sales using it are credited to them. */
export interface AffiliateCouponDto {
  code: string;
  description: string;
  type: "percent" | "fixed";
  percentOff: number | null;
  amountOffPaise: number | null;
  endsAt: string | null;
  /** The store, with the code filled in at checkout. */
  url: string;
}

export interface AffiliateProductDto {
  productId: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  coverUrl: string | null;
  pricePaise: number;
  effectivePricePaise: number;
  commission: { type: CommissionType; value: number; perSalePaise: number };
  link: { code: string; url: string; clicks: number } | null;
}

export interface AffiliateStats {
  days: number;
  clicks: number;
  uniqueVisitors: number;
  sales: number;
  conversionRate: number;
  earnings: Record<CommissionStatus, { amountPaise: number; count: number }>;
  series: { date: string; clicks: number; sales: number; earnedPaise: number }[];
  products: { productId: string; title: string; clicks: number; sales: number; earnedPaise: number }[];
}

export interface CommissionDto {
  id: string;
  orderNumber: string;
  productTitle: string;
  baseAmountPaise: number;
  rule: { type: CommissionType; value: number };
  amountPaise: number;
  status: CommissionStatus;
  holdUntil: string;
  createdAt: string;
}

export interface PayoutDto {
  id: string;
  amountPaise: number;
  commissionCount: number;
  status: PayoutStatus;
  method: "upi" | "bank_transfer" | null;
  destination: string | null;
  reference: string | null;
  paidAt: string | null;
  adminNote: string | null;
  affiliateNote: string | null;
  createdAt: string;
}

export const affiliateProfileKey = ["affiliate", "me"] as const;

/** The signed-in user's affiliate profile, or null if they have not applied. */
export function useAffiliateProfile(enabled = true) {
  return useQuery({
    queryKey: affiliateProfileKey,
    enabled,
    queryFn: async () => {
      try {
        return (await api<{ profile: AffiliateProfileDto }>("/affiliate/me")).profile;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
        throw err;
      }
    },
  });
}

export function commissionLabel(c: { type: CommissionType; value: number }): string {
  return c.type === "percent" ? `${(c.value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%` : `₹${(c.value / 100).toLocaleString("en-IN")} fixed`;
}

export const COMMISSION_STATUS_INFO: Record<CommissionStatus, { label: string; help: string; className: string }> = {
  pending: { label: "Pending", help: "Sale verified; inside the refund hold period.", className: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", help: "Approved; becomes payable when the hold period ends.", className: "bg-accent text-accent-foreground" },
  payable: { label: "Payable", help: "Ready to include in a payout request.", className: "bg-success/15 text-success border-success/20" },
  processing: { label: "Processing", help: "Included in a payout request.", className: "bg-warning/15 text-warning border-warning/20" },
  paid: { label: "Paid", help: "Paid out to you.", className: "bg-success/15 text-success border-success/20" },
  reversed: { label: "Reversed", help: "Cancelled, usually because the order was refunded.", className: "bg-destructive/10 text-destructive border-destructive/20" },
};
