# Progress

All six phases are implemented. **83 API tests and 7 shared-package tests pass**, the
typecheck and lint are clean, and the production builds succeed.

## What has and hasn't been verified

| Area | Verified by |
|---|---|
| Auth, roles, portals, sessions | API tests plus a live smoke test through the web proxy |
| Catalog, uploads, PDF rendering | API tests (inline renderer), a live upload in dev (worker thread under tsx), and the **production bundle** rendering a 12-page PDF through its worker |
| Payments | API tests with real HMAC signatures against a **test-only fake Razorpay API**. **Not yet run against Razorpay itself**: no test keys are configured, so live checkout correctly returns `PAYMENTS_NOT_CONFIGURED` |
| Reader and library | API tests (entitlements, watermark, progress, bookmarks). The page-flip UI type-checks and builds, but **has not been tried in a real browser** in this environment |
| Affiliates and payouts | API tests covering the full flow, plus the security regressions |
| Email | Development console transport only. **No real SMTP provider is configured yet** |
| S3 storage | Implemented with the AWS SDK. **Not run against a real bucket**: Docker/MinIO wasn't available, so development used the local driver |

## Phase summary

1. **Foundation:**
   - Monorepo, environment validation, 17 Mongoose models.
   - Sessions, the three login portals, email verification, password reset, magic links.
   - Role-based access, audit log, rate limits, origin checks.
2. **Catalog:**
   - Admin eBook management: create, edit, publish, unpublish, archive, restore.
   - Pricing and discounts, per-book commission rules.
   - Cover upload with re-encoding; private PDF upload rendered to WebP pages in a worker
     thread; table of contents extracted from the PDF's bookmarks; watermarked samples.
   - Public marketplace with search, category filter, sorting and pagination; book pages
     with SEO metadata; featured books on the home page.
3. **Payments:**
   - Razorpay orders priced on the server, guest checkout, HMAC verification plus a
     server-side payment fetch, signed webhooks with idempotent fulfilment.
   - Purchase email with a 72-hour sign-in link; order confirmation page.
   - Admin orders: full or partial refunds through Razorpay, reconciliation.
   - Customer order history.
4. **Reader and library:**
   - Entitlement checked on every page request; per-user watermarks; per-user rate limits.
   - Page-flip reader: swipe, keyboard, full screen, table of contents, bookmarks, a page
     slider, dark mode and saved progress.
   - Library with "continue reading", progress bars and "explore more"; bookmarks page.
5. **Affiliates:**
   - Application with admin approval or rejection.
   - Referral links (`/r/:code`) with bot and duplicate filtering, last-click attribution
     over 30 days in a signed cookie that carries over to the account.
   - Commission ledger with full history; refund reversal or re-basing, clawback flags.
   - Payout requests with encrypted bank details; admin records payment with a real
     reference.
   - Affiliate and admin analytics.
6. **Hardening:**
   - Independent security review; 7 findings, of which 5 were fixed with regression tests
     and 2 low-severity trade-offs documented (below).
   - Production bundle verified, API reference written, deployment checklist written.

## Known limitations and trade-offs

- **Screenshots and screen recording cannot be prevented.** The reader deters copying:
  - pages are served one at a time as watermarked images;
  - there is no PDF download and no right-click;
  - print is blocked;
  - each user has a page-rate limit.
- **Guest checkout reveals ownership.** With an email that already owns a book, guest
  checkout says so. This leaks that the email bought that title. The alternative would be
  silently charging twice.
- **Guest self-referral isn't fully blocked.** An affiliate could buy their own book as a
  guest under another email. The refund hold and manual commission approval are the
  safeguard: review unusual patterns before approving.
- **Single API instance.** PDF processing and rate limits are in-process. See "Scaling" in
  [DEPLOYMENT.md](DEPLOYMENT.md).
- **Legal pages are templates** and need legal review.

## Before launch

1. Add Razorpay **test** keys and the webhook secret, then run the go-live checklist in
   [DEPLOYMENT.md](DEPLOYMENT.md). That checklist covers the real-browser checks for the
   reader and checkout.
2. Configure SMTP and a private S3 bucket.
3. Replace the "Deep Focus (Demo)" product with your first real eBook (archive the demo).
