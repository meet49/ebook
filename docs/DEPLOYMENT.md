# Production deployment checklist

## Topology

```
Browser ──HTTPS──> Edge proxy (Nginx / Caddy / cloud load balancer)
                     ├── /api/*  ──> Express API      (private network, TRUST_PROXY=1)
                     ├── /r/*    ──> Express API      (rewrite to /api/v1/r/*)
                     └── /*      ──> Next.js web
API ──> MongoDB replica set / Atlas   API ──> private S3 bucket   API ──> Razorpay, SMTP
```

- Route `/api/*` (and `/r/:code` → `/api/v1/r/:code`) from the edge proxy **directly to the
  API**. Next.js rewrites work, but Next's proxy does not add the real client IP to
  `X-Forwarded-For`. The API needs the real IP for rate limits and audit logs.
- The edge proxy must set or append `X-Forwarded-For`. Set `TRUST_PROXY` to the number of
  proxies in front of the API (usually `1`).
- The API port must not be reachable from the internet.
- Allow request bodies of at least `MAX_PDF_MB` on `/api/v1/admin/products/*/pdf` (for
  Nginx, `client_max_body_size 210m;` for that location). Use a long timeout there.
- Run **one API instance** for the MVP. PDF rendering and rate limits are in-process (see
  "Scaling" below).
- The API needs ~1 GB RAM headroom while rendering large PDFs. Rendering runs in a worker
  thread, so requests stay responsive. No system packages are needed: pdfjs and canvas
  ship prebuilt binaries for Linux x64/arm64 and Windows.

## Environment

**Core**
- [ ] `NODE_ENV=production` (enables `Secure` cookies and the production config checks)
- [ ] `APP_URL=https://your-domain` (validated at boot; used in email links and origin checks)
- [ ] `APP_SECRET`: at least 48 random bytes, from a secret manager. **Never rotate it
      casually.** It also encrypts affiliate bank account numbers, which become
      unreadable after a rotation.

**Data and storage**
- [ ] `MONGODB_URI`: a replica set or Atlas, with TLS and a least-privilege user. Include
      the database name, e.g. `...mongodb.net/ebook`. `DNS_SERVERS` is only for hosts
      whose resolver refuses SRV lookups.
- [ ] `STORAGE_DRIVER=s3` (`local` is refused in production), plus `S3_BUCKET`,
      `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_ENDPOINT` /
      `S3_FORCE_PATH_STYLE` for R2, Spaces or MinIO.
- [ ] The bucket is **private**: Block Public Access is on, there is no public bucket
      policy, and the IAM key allows only `s3:GetObject`, `PutObject`, `DeleteObject` and
      `ListBucket` on that bucket.

**Email**
- [ ] `EMAIL_TRANSPORT=smtp` with your provider's SMTP host and credentials (`console` is
      refused in production).
- [ ] `EMAIL_FROM` is on a domain with SPF, DKIM and DMARC set up.

**Payments and affiliates**
- [ ] Razorpay: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, using **live** keys only in
      production.
- [ ] Razorpay webhook:
  - **URL:** `https://your-domain/api/v1/webhooks/razorpay`
  - **Events:** `payment.captured`, `order.paid`, `payment.failed`, `refund.created`,
    `refund.processed`, `refund.failed`
  - **Secret:** set it in `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Razorpay dashboard: automatic capture is ON (Settings → Payment capture). The API
      also captures `authorized` payments itself during verification.
- [ ] `ATTRIBUTION_WINDOW_DAYS`, `COMMISSION_HOLD_DAYS` and `MIN_PAYOUT_PAISE` are set to
      your business rules. The hold should be at least your refund window, e.g. 7 days.

**Admin seed**
- [ ] Run `npm run seed:admin` once with `SEED_ADMIN_*`, then remove `SEED_ADMIN_PASSWORD`
      from the environment.

**Web**
- [ ] `API_URL` (server-side, used by Next.js server rendering) and `NEXT_PUBLIC_SITE_URL`.

## Security

- [ ] HTTPS everywhere, with HSTS enabled at the edge.
- [ ] Consider a Content-Security-Policy at the edge. Razorpay Checkout needs:
  - `script-src https://checkout.razorpay.com`
  - `frame-src https://api.razorpay.com https://checkout.razorpay.com`
  - `connect-src https://lumberjack.razorpay.com`

  Test in report-only mode first.
- [ ] MongoDB backups (point-in-time where available), with a restore test done.
- [ ] Logs are aggregated. Cookies, authorization headers, passwords and tokens are
      already redacted.
- [ ] `npm audit --omit=dev` is clean. The remaining advisory (`braces`) is in dev tooling
      only.
- [ ] Legal pages (`/legal/*`) are templates. Have counsel review them, including DPDP Act
      2023 obligations and the refund window.
- [ ] The reader deters copying through watermarking, rate limits and no PDF delivery. It
      **cannot prevent screenshots or screen recording**, so say so in your terms.

## Build & run

```bash
npm ci
npm run typecheck && npm test
npm run build
# API (bundled; third-party packages stay external, so keep node_modules)
NODE_ENV=production node --enable-source-maps apps/api/dist/server.js
# Web
npm run start --workspace @ebook/web
```

- `GET /api/health` returns `200` only when MongoDB is connected. Use it for liveness and
  readiness checks.
- On `SIGTERM` the API drains HTTP connections, then closes the database.
- If the API restarts mid-render, unfinished PDF rendering resumes on the next boot.

## Scaling beyond one API instance

- **Rate limits:** plug a shared store (for example `rate-limit-redis`) into the limiters
  in `middleware/rateLimit.ts` and `modules/library/reader.routes.ts`.
- **PDF processing:** move `modules/products/processing.ts` to a shared queue (BullMQ or
  Agenda) so only one worker renders each upload. The `queued` → `processing` status
  fields are already in place.

## Go-live verification

**Accounts**
- [ ] Register, verify email, sign out, reset password, and magic-link sign-in all work
      with real email delivery.
- [ ] A customer account cannot sign in at `/admin/login` or `/affiliate/login`.

**Catalog**
- [ ] Upload a real eBook PDF: pages render, the table of contents is filled from its
      bookmarks, samples show the watermark, and you can publish.

**Purchases (Razorpay TEST mode)**
- [ ] Guest purchase: the purchase email arrives, its link opens `/read/<slug>`, and pages
      carry your email in the watermark.
- [ ] Purchase while signed in: the confirmation page offers "Start reading".
- [ ] Disable the browser callback (close the tab right after paying): the webhook alone
      fulfils the order.
- [ ] Refund from **Admin → Orders**: access is removed and the commission is reversed.

**Affiliates**
- [ ] Apply, approve, create a link, open it in a private window, then buy. The order shows
      "Affiliate", and a ₹200 commission is created on a ₹1,000 sale at 20%.
- [ ] Approve the commission, wait out (or shorten) the hold, request a payout, pay it
      manually, and record the UTR.

**Going live**
- [ ] Switch to live Razorpay keys and webhook secret. Make one real low-value purchase,
      then refund it.
