# Architecture & Implementation Plan

Digital eBook store + affiliate program — MVP.

## 1. Repository layout (npm workspaces monorepo)

```
ebook/
├── apps/
│   ├── api/                      Express + TypeScript REST API
│   │   ├── src/
│   │   │   ├── app.ts            Express app factory (no listen; used by tests)
│   │   │   ├── server.ts         Boot: DB connect + listen
│   │   │   ├── config/env.ts     Zod-validated environment
│   │   │   ├── db/               Mongoose connection
│   │   │   ├── models/           All Mongoose models (one file each)
│   │   │   ├── middleware/       auth, rbac, validate, rate-limit, error
│   │   │   ├── lib/              crypto, money, email, storage, http errors, audit
│   │   │   └── modules/          Feature modules: routes + service per domain
│   │   │       ├── auth/         login/register/logout/verify/reset/magic link
│   │   │       ├── products/     public catalog + admin CRUD        (Phase 2)
│   │   │       ├── checkout/     Razorpay orders, verify, webhooks  (Phase 3)
│   │   │       ├── library/      entitlements, reader, progress     (Phase 4)
│   │   │       ├── affiliate/    applications, links, clicks        (Phase 5)
│   │   │       ├── commissions/  ledger, payouts                    (Phase 5)
│   │   │       └── admin/        stats, customers, audit
│   │   └── test/                 Vitest + Supertest + mongodb-memory-server
│   └── web/                      Next.js (App Router) + Tailwind + shadcn/ui
│       └── src/
│           ├── app/
│           │   ├── (public)/     storefront, auth pages, legal, checkout
│           │   ├── (customer)/   library, reader, account
│           │   ├── affiliate/    (auth)/login, apply  +  (dashboard)/…
│           │   └── admin/        (auth)/login  +  (dashboard)/…
│           ├── components/       ui/ (shadcn), layout/, forms/, shared
│           ├── lib/              api client, query client, auth hooks, utils
│           └── proxy.ts          Optimistic route guard (cookie presence)
├── packages/
│   └── shared/                   Zod schemas, enums, money helpers, API types
├── docker-compose.yml            MongoDB + MinIO (S3-compatible) for local dev
└── docs/                         Architecture, API, setup, deployment
```

Frontend and backend share **only** validation schemas, enums and types via
`@ebook/shared`. All business rules (prices, commissions, entitlements,
attribution) live exclusively in the API.

The browser talks to the API through a Next.js rewrite (`/api/*` → API). That
keeps the session cookie first-party (`SameSite=Lax`, `HttpOnly`, `Secure` in
prod) and avoids CORS for the app itself.

## 2. Authentication & authorization

- **Sessions:** opaque random token in an `HttpOnly` cookie; only its SHA-256
  hash is stored (`Session` collection, TTL index). Revocable, rotates on
  login, 30-day sliding expiry. Logout deletes the session.
- **Passwords:** bcrypt (cost 12). Login is rate limited per IP+email.
- **Roles:** `customer`, `affiliate`, `admin` (a user can hold several, e.g. a
  customer who becomes an affiliate). Public visitors are unauthenticated.
- **Portals:** `/login` (customer), `/affiliate/login`, `/admin/login`. The
  login request carries `portal`; the API rejects a login whose user lacks the
  portal's role, so admin credentials never authenticate through the customer
  screen and vice-versa.
- **Single-use tokens** (`AuthToken`, hashed, expiring): email verification
  (24 h), password reset (1 h), magic login link (30 min — used for the
  post-purchase "access your library" email).
- **Checkout accounts:** a buyer who isn't signed in enters name + email. If the
  email matches an existing account, the purchase is attached to it (no login
  is granted by knowing an email — access comes via the emailed magic link or
  their password). Otherwise a passwordless customer account is created; the
  magic link verifies the email and lets them set a password.
- **CSRF:** `SameSite=Lax` cookie plus an `Origin` check on state-changing
  requests.
- **RBAC middleware:** `requireAuth`, `requireRole('admin')`, etc. The Next.js
  proxy only does optimistic redirects; the API is the real gatekeeper.

## 3. Data models (MongoDB / Mongoose)

All money is **integer paise** (`*Paise` fields). Percent commission is stored
in **basis points** (2000 = 20%).

| Model | Key fields | Indexes |
|---|---|---|
| User | name, email, passwordHash?, roles[], emailVerifiedAt, status, lastLoginAt, referral{clickId, at} | email unique |
| Session | userId, tokenHash, expiresAt, ip, userAgent | tokenHash unique, TTL on expiresAt |
| AuthToken | userId, purpose, tokenHash, expiresAt, usedAt | tokenHash unique, TTL |
| AffiliateProfile | userId, code, status (pending/approved/rejected/suspended), application{…}, payoutDetails{…}, review{by, at, note} | userId unique, code unique |
| Product | slug, title, subtitle, author, description, benefits[], categories[], pricePaise, salePricePaise?, status (draft/published/unpublished/archived), featured, affiliate{enabled, type: percent/fixed, value}, toc[], previewPages[], pageCount, coverAssetId | slug unique, status+featured |
| ProductAsset | productId, kind (original_pdf/cover/page_image), storageKey, mime, size, page?, checksum, status | productId+kind+page |
| AffiliateProduct | affiliateId, productId, linkCode, clicks | (affiliateId, productId) unique, linkCode unique |
| AffiliateClick | affiliateId, productId, affiliateProductId, visitorId, ipHash, userAgent, referrer | affiliateId+createdAt |
| Order | orderNumber, userId, productId, amountPaise, currency, status (created/paid/failed/refunded/partially_refunded), razorpay{orderId, paymentId, signature}, attribution{type: affiliate/direct, affiliateId, clickId, clickedAt}, refunds[], paidAt | orderNumber unique, razorpay.orderId unique, razorpay.paymentId unique sparse |
| PaymentEvent | provider, eventId, type, payload, status, error, processedAt | (provider, eventId) unique |
| Entitlement | userId, productId, orderId, status (active/revoked) | (userId, productId) unique |
| Commission | orderId, affiliateId, productId, baseAmountPaise, rule{type, value}, amountPaise, status, holdUntil, payoutId, history[] | orderId unique |
| Payout | affiliateId, amountPaise, commissionIds[], status (requested/processing/paid/rejected), method, reference, paidAt, processedBy | affiliateId+status |
| ReadingProgress | userId, productId, page, totalPages, percent, lastOpenedAt | (userId, productId) unique |
| Bookmark | userId, productId, page, label | (userId, productId, page) unique |
| Notification | userId, type, title, body, readAt | userId+createdAt |
| AuditLog | actorId, action, entity{type, id}, meta, ip | createdAt, entity |

`Session` and `AuthToken` are additions to the requested list, needed for
revocable sessions and single-use email links.

## 4. Business rules

### Payments (Razorpay)
1. `POST /checkout/orders` — server reads the price from the Product, resolves
   attribution from the server-side click cookie, creates a Razorpay order and
   a local `Order(created)`.
2. Browser runs Razorpay Checkout, posts `{razorpay_order_id, payment_id,
   signature}` to `POST /checkout/verify`. Server checks the HMAC, fetches the
   payment from Razorpay to confirm `captured` + amount + currency, then
   fulfils.
3. Webhook `POST /webhooks/razorpay` (raw-body HMAC check) handles
   `payment.captured`, `payment.failed`, `refund.processed`. Events are stored
   in `PaymentEvent` with a unique `(provider, eventId)` index → duplicates are
   no-ops.
4. **Fulfilment is idempotent** (verify endpoint and webhook can race):
   atomic `created → paid` transition, upsert entitlement, insert commission
   (unique `orderId`), send email once.

### Attribution
- `/r/:linkCode` records an `AffiliateClick`, sets an `HttpOnly` cookie holding
  the click id (30 days, configurable `ATTRIBUTION_WINDOW_DAYS`) and redirects to
  the product page. **Last eligible click wins.**
- On login/checkout the click is also copied to `User.referral` so it survives
  a cookie-less device switch after sign-in.
- At order creation, a click counts only if: within window, affiliate
  approved, product affiliate-enabled, buyer ≠ affiliate (no self-referral).
  Otherwise the order is `direct`.
- Repeat purchases: each purchase inside the window of the latest eligible
  click is attributed to that affiliate; after the window, sales are direct.

### Commissions
- Commissionable amount = amount actually captured for the order (after
  discount). Percent → `floor(amount × bps / 10000)`; fixed → `min(value,
  amount)`. Rule is snapshotted on the commission.
- Lifecycle: `pending` (inside refund hold, default 7 days) → `approved`
  (admin) → `payable` (approved and hold elapsed) → `processing` (in a payout
  request) → `paid` (admin records the real transfer reference). Any refund
  before payment → `reversed`. Refund after payout → `reversed` with a
  clawback flag for manual recovery.
- Clicks alone never create commission.

### Reader security
- Original PDFs live in a **private** bucket; never public, never emailed.
- On upload the API only reads the PDF (page count, page size, bookmarks); it
  does not render page images.
- `GET /reader/:productId/book` checks session + active entitlement + rate
  limit and requires the `x-readnshare-reader` header, then returns that
  buyer's personal copy: every page carries a footer (email, order number,
  copyright notice) and a faint diagonal email watermark, and the document
  metadata names the licensee. It is sent as `application/octet-stream` with
  `Cache-Control: private, no-store`, so opening the URL directly does not show
  or save a PDF. The browser renders pages with pdf.js. No storage URLs reach
  the browser.
- A technical user can still extract the file from the browser, and an expert
  can edit the watermark out. Screenshots, screen recording and manual copying
  **cannot be prevented** either. These measures stop casual downloading and
  make leaks traceable to the buyer.

## 5. Route architecture

### Web (Next.js)
| Area | Routes |
|---|---|
| Public | `/`, `/ebooks`, `/ebooks/[slug]`, `/checkout/[slug]`, `/checkout/success`, `/affiliates`, `/legal/{terms,privacy,refunds}` |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/magic` |
| Customer | `/library`, `/library/orders`, `/library/bookmarks`, `/read/[slug]`, `/account` |
| Affiliate | `/affiliate/login`, `/affiliate/apply`, `/affiliate`, `/affiliate/products`, `/affiliate/commissions`, `/affiliate/payouts`, `/affiliate/profile` |
| Admin | `/admin/login`, `/admin`, `/admin/products[/new\|/[id]]`, `/admin/orders`, `/admin/customers`, `/admin/affiliates`, `/admin/commissions`, `/admin/payouts`, `/admin/audit` |

### API (`/api/v1`)
| Prefix | Auth | Purpose |
|---|---|---|
| `/auth` | public / session | register, login, logout, me, verify-email, forgot/reset password, magic link |
| `/products` | public | published catalog, search, filters, detail, sample pages |
| `/checkout`, `/webhooks/razorpay` | optional session / signature | orders, verification, webhooks |
| `/me` | customer | library, orders, progress, bookmarks |
| `/reader` | customer + entitlement | page images, TOC |
| `/r/:code` | public | affiliate click → redirect |
| `/affiliate` | affiliate | apply, profile, products, links, stats, commissions, payouts |
| `/admin` | admin | products, uploads, orders, refunds, customers, affiliates, commissions, payouts, analytics, audit |

## 6. Phases

1. **Foundation** — monorepo, env validation, DB + all models, auth (sessions,
   portals, email verification, reset, magic link), RBAC, email provider,
   shared UI kit and role layouts, tests.
2. **Catalog** — admin product CRUD/publish/archive, S3 uploads (cover, PDF),
   PDF → page images, public marketplace with search/filters, detail pages.
3. **Payments** — Razorpay orders, signature verification, webhooks,
   idempotent fulfilment, guest checkout accounts, purchase emails, refunds.
4. **Reader & library** — protected watermarked pages, page-flip reader,
   TOC, bookmarks, progress, library dashboard.
5. **Affiliates** — applications/approval, links, click tracking, attribution,
   commission ledger, payout requests, admin payout processing.
6. **Hardening** — security review, e2e tests, docs, deployment checklist.

## 7. Explicitly out of scope
Ad-platform APIs, automated payouts, subscriptions, multi-level commissions,
microservices.

## 8. Implementation notes (as built)

- **PDF pipeline.** The upload streams to a temp file and is checked by its file
  signature. The original goes to private storage. Processing only analyses the PDF
  (pdf-lib validates it; pdfjs-dist reads the page count, page size and bookmarks, which
  pre-fill the table of contents), so it is fast and light on memory. Personal copies are
  stamped with pdf-lib the first time a buyer opens the book and cached in private
  storage per "page set" version; the public sample is a separate PDF of the preview
  pages stamped "SAMPLE". Unfinished jobs resume at boot.
- **Storage drivers.** `local` (development) and `s3` (any S3-compatible service). Both
  sit behind one interface, and storage keys never leave the API.
- **Reader.** It uses the `page-flip` library (MIT) directly, not the `react-pageflip`
  wrapper, which is unmaintained and has StrictMode issues. Page nodes are created
  imperatively; pdf.js renders pages near the current page in the browser. Opening the
  book re-checks the entitlement and downloads the buyer's watermarked copy.
- **Payments.** Gateway calls go through a `PaymentGateway` interface, implemented over
  Razorpay REST; tests substitute a fake. Fulfilment is idempotent across the browser
  verify call, webhooks and admin reconciliation.
- **Commissions.** `pending → approved → payable → processing → paid`, or `reversed`. A
  refund during an open payout shrinks that payout atomically. Bank account numbers are
  AES-256-GCM encrypted; each payout freezes an encrypted snapshot of its destination.
  Only one payout can be open per affiliate (enforced by a partial unique index).
- **Attribution.** A signed `ebook_ref` cookie, plus `User.referral`, which only the
  signed-in account owner can update. Last eligible click wins within
  `ATTRIBUTION_WINDOW_DAYS`.
