# API reference

Base path: `/api/v1`. The browser reaches it at the web origin: Next.js proxies `/api/*` in
development, and the edge proxy does so in production.

## Conventions

- **Bodies:** JSON request and response bodies; uploads use `multipart/form-data` with
  a single `file` field.
- **Money:** always integer **paise**. Percent commissions are **basis points**
  (2000 = 20%).
- **Auth:** the `ebook_sid` session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in
  production).
- **Origin check:** state-changing requests carrying an `Origin` header must come from
  `APP_URL` or `ALLOWED_ORIGINS`, otherwise `403`.
- **Pagination:** `?page=&pageSize=` → `{ items, page, pageSize, total }`.
- **Errors:**
  `{ "error": { "code": "…", "message": "…", "details": { "field": ["…"] } } }`

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Validation failed (`details` maps fields to messages) |
| `INVALID_TOKEN` / `INVALID_SIGNATURE` | 400 | Bad email-link token / payment signature |
| `UNAUTHORIZED`, `INVALID_CREDENTIALS` | 401 | Not signed in / wrong email or password |
| `FORBIDDEN`, `WRONG_PORTAL` | 403 | No access / account lacks the login page's role (`details.portals` lists the right ones) |
| `NOT_FOUND` | 404 | |
| `CONFLICT`, `ALREADY_OWNED`, `INVALID_STATUS`, `NOT_READY`, `PAYMENT_NOT_CAPTURED`, `PAYOUT_IN_PROGRESS` | 409 | State conflicts |
| `PAYLOAD_TOO_LARGE` | 413 | Upload over the limit |
| `RATE_LIMITED` | 429 | |
| `GATEWAY_ERROR`, `GATEWAY_UNAVAILABLE` | 502 | Razorpay error / unreachable |
| `PAYMENTS_NOT_CONFIGURED` | 503 | Razorpay keys missing |

## Health

`GET /api/health` → `200 {status:"ok",db:"up"}`, or `503` when the database is down.

## Auth (`/auth`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | `{name,email,password}` | `201 {user}` + session; sends verification email; `409` if the email exists |
| POST | `/login` | `{email,password,portal}` | `portal`: `customer` / `affiliate` / `admin`. Rate limit: 10 per 15 min per IP+email |
| POST | `/logout` | — | Deletes the session server-side |
| GET / PATCH | `/me` | `{name}` | Current user / update name |
| POST | `/change-password` | `{currentPassword?,newPassword}` | Current password is only needed if one is set; signs out other sessions |
| POST | `/resend-verification` | — | |
| POST | `/verify-email` | `{token}` | |
| POST | `/forgot-password` | `{email}` | Always `202` (no account enumeration) |
| POST | `/reset-password` | `{token,password}` | Signs out all sessions |
| POST | `/magic-link` | `{email,redirectTo?}` | Always `202`; `redirectTo` must be a relative path |
| POST | `/magic-login` | `{token}` | `{user,redirectTo}` + session |

Email tokens are single-use and stored hashed. Lifetimes: verify email 24 h, reset 1 h,
sign-in link 30 min (72 h for the link in the purchase email).

## Public catalog (`/products`)

| Method | Path | Notes |
|---|---|---|
| GET | `/products?q&category&sort&featured&page&pageSize` | Published only. `sort`: `featured` / `newest` / `price_asc` / `price_desc`. Returns `ProductSummary[]` |
| GET | `/products/categories` | `{categories: string[]}` |
| GET | `/products/:slug` | `ProductDetail`: description, benefits, TOC, `addOns` (same-category books with a combo price) |
| GET | `/products/:slug/cover` | WebP, publicly cacheable |

Responses never include storage keys or commission settings.

## Checkout & payments

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/checkout/config` | — | `{mode: "test" \| "live" \| "unconfigured"}` |
| POST | `/checkout/orders` | optional | `{productSlug, addOnSlugs?, name?, email?}`. Prices, combo eligibility and attribution are server-side. Add-ons (max 3) must share a category with the main book and have a combo price. The main book costs its combo price within 24 h of the buyer's last same-category purchase. Response includes `lines`. Guests: existing email → order attached, **no session**; new email → passwordless customer. `409 ALREADY_OWNED` (for an add-on, `details.addOnSlugs`) |
| POST | `/checkout/quote` | optional | `{productSlug, addOnSlugs?, fromOrder?}` → `CheckoutQuote` (lines, total, savings, available add-ons, offer expiry). Display only; the order is re-priced on creation |
| POST | `/checkout/verify` | — | `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` → HMAC check, server-side fetch of the payment (status `captured`, amount, currency, order id) → idempotent fulfilment |
| GET | `/checkout/orders/:orderNumber` | — | Status for the confirmation page: `lines`, masked email, `isOwner` |
| GET | `/checkout/orders/:orderNumber/offers` | — | Combo offers for 24 h after the order was paid (empty otherwise) |
| GET | `/site-config` | — | Public settings for the website: `{ analytics: { gaMeasurementId } }` (set in Admin → Settings) |
| POST | `/webhooks/razorpay` | signature | Raw body; `X-Razorpay-Signature` HMAC. Handles `payment.captured`, `order.paid`, `payment.failed`, `refund.created`, `refund.processed`, `refund.failed`. Deduplicated by `X-Razorpay-Event-Id` |

**Fulfilment** (idempotent; the verify call and webhook may race):
1. Atomic `created`/`failed` → `paid`.
2. Add the `customer` role.
3. Upsert the entitlement.
4. Create the commission (unique per order).
5. Mark the referral click converted.
6. Send the purchase email exactly once.

A refunded order never regains access from a late event.

## Customer (`/me`, `/reader`) — signed in

| Method | Path | Notes |
|---|---|---|
| GET | `/me/library` | `{items, explore}`: owned books with progress, plus unowned published books |
| GET | `/me/orders` | Order history (abandoned checkouts excluded), each with `lines` |
| GET | `/me/offers` | Same-category books at their combo price for 24 h after a purchase |
| PUT | `/me/progress/:productId` | `{page}` → `{page, percent}`; requires entitlement |
| GET / POST | `/me/bookmarks` | POST `{productId, page, label?}` (upsert per page) |
| DELETE | `/me/bookmarks/:id` | Own bookmarks only |
| GET | `/reader/by-slug/:slug` | Manifest: page count, size, TOC, progress, bookmarks, `bookUrl`, `readerHeader`. `403` without an entitlement |
| GET | `/reader/:productId/book` | The buyer's personal PDF: footer (email, order number, copyright) and a faint email watermark on every page. Requires the `x-readnshare-reader: 1` header (else `403 READER_ONLY`) and an active entitlement. Sent as `application/octet-stream`, `Cache-Control: private, no-store`. 60 per hour per user |
| GET | `/reader/:productId/cover` | Cover for owners (works for archived books) |

## Affiliates

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/r/:code` | — | Records the click (bots and self-clicks are skipped; repeat clicks within 30 min are de-duplicated), sets the signed `ebook_ref` cookie for `ATTRIBUTION_WINDOW_DAYS` and redirects to the book. The web app maps `/r/:code` here |
| POST | `/affiliate/apply` | optional | Signed in: application fields. Visitors also send `name, email, password` (creates the account and session) |
| GET | `/affiliate/me` | affiliate | Profile, status, payout details (masked) |
| PUT | `/affiliate/me/payout` | affiliate | `{method:"upi",upiId}` or `{method:"bank_transfer",accountName,accountNumber,ifsc}`. Account number is AES-256-GCM encrypted |
| GET | `/affiliate/products` | approved | Eligible books with commission per sale and the affiliate's link |
| POST | `/affiliate/links` | approved | `{productId}` → idempotent link creation |
| GET | `/affiliate/stats?days` | approved | Clicks, unique visitors, sales, conversion, earnings by status, daily series (IST), per-product breakdown |
| GET | `/affiliate/commissions?status` | affiliate | The affiliate's ledger entries |
| GET | `/affiliate/payouts` | affiliate | Payable balance, minimum, history |
| POST | `/affiliate/payouts` | approved | `{note?}`: claims all payable commissions atomically; enforces the minimum; one open request at a time |

**Attribution rules:**
- The newest eligible click wins, from the cookie or from the account (copied there at
  sign-in, so it survives device switches).
- The click must be inside the window, the affiliate approved, the product
  affiliate-enabled, and the buyer must not be the affiliate.
- It applies to any eligible eBook bought inside the window, and to repeat purchases.
- Otherwise the sale is `direct`.

## Admin (`/admin/*`) — admin role

| Area | Endpoints |
|---|---|
| Users | `GET /users?q&role`, `PATCH /users/:id/status` `{status}` (suspending revokes sessions) |
| Products | `GET /products?q&status`, `POST /products`, `GET/PUT /products/:id`, `POST /products/:id/{publish,unpublish,archive,restore,reprocess}`, `POST /products/:id/cover` (image), `POST /products/:id/pdf` (PDF → `202`, analysed in the background), `GET /products/:id/cover`, `GET /products/:id/pdf` (original, admin only), `DELETE /products/:id` (only books nobody bought; else `409 HAS_SALES`) |
| Orders | `GET /orders?q&status`, `GET /orders/:id` (with webhook events and commission), `POST /orders/:id/refund` `{amountPaise?, reason}` (real Razorpay refund), `POST /orders/:id/reconcile` (looks up captured payments at Razorpay) |
| Affiliates | `GET /affiliates?status`, `POST /affiliates/:id/{approve,reject,suspend,reinstate}` `{note?}` |
| Commissions | `GET /commissions?status&affiliateId` (with totals and history), `POST /commissions/approve` `{ids}`, `POST /commissions/:id/reverse` `{note}` |
| Payouts | `GET /payouts?status`, `GET /payouts/:id/destination` (decrypted; audited), `POST /payouts/:id/start`, `POST /payouts/:id/mark-paid` `{reference, note?}` (**requires a real transaction reference**), `POST /payouts/:id/reject` `{note}` (commissions return to payable) |
| Analytics | `GET /stats?days`: revenue (gross, refunds, net), daily series, top products, customers, affiliates, commission totals, open payouts |
| Audit | `GET /audit?action` (prefix filter) |

**Product publish requirements:** a cover, a processed PDF, a description and a price of at
least ₹1. `NOT_READY` lists what is missing in `details.publish`.

**Commission lifecycle:**
- `pending` (refund hold, `COMMISSION_HOLD_DAYS`) → `approved` (admin) → `payable`
  (automatically, once the hold has ended) → `processing` (in a payout request) → `paid`
  (admin records the reference).
- A full refund before payment → `reversed`. A partial refund recalculates on the net
  amount.
- A refund after payment sets `clawbackRequired`.
