# ReadnShare — eBook store & affiliate platform (MVP)

Sell digital eBooks, let customers read them in a secure online reader, and run an
affiliate program with an auditable commission ledger.

| Part | Stack |
|---|---|
| `apps/web` | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, React Hook Form + Zod, Framer Motion, page-flip |
| `apps/api` | Node.js, Express 5, TypeScript, MongoDB + Mongoose 9, Razorpay, pdfjs + canvas (worker thread), sharp |
| `packages/shared` | Zod schemas, enums, money helpers and types shared by both apps |

Docs: [Architecture & plan](docs/ARCHITECTURE.md) · [API reference](docs/API.md) ·
[Deploy on Render](docs/DEPLOY-RENDER.md) · [Deployment checklist](docs/DEPLOYMENT.md) · [Progress & known limitations](docs/PROGRESS.md)

## Prerequisites

- Node.js 22.18 or newer (developed on 22.22).
- MongoDB 7 or newer, running as a **replica set**: either MongoDB Atlas, or the included
  `docker-compose.yml` (MongoDB + MinIO).
- No system packages. The API reads and stamps PDFs with pdf-lib and pdfjs-dist; pages
  are rendered in the browser.

## Local setup

```bash
npm install

# Configure
cp apps/api/.env.example apps/api/.env      # set APP_SECRET and MONGODB_URI (see the comments)
cp apps/web/.env.example apps/web/.env.local

# Optional: local MongoDB + MinIO instead of Atlas / S3
docker compose up -d

# First admin (set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in apps/api/.env first)
npm run seed:admin

# Run (two terminals)
npm run dev:api     # API → http://localhost:5000
npm run dev:web     # Web → http://localhost:3000
```

| Area | URLs |
|---|---|
| Store | `/`, `/ebooks`, `/ebooks/<slug>`, `/checkout/<slug>` |
| Customer | `/login`, `/register`, `/library`, `/read/<slug>`, `/account` |
| Affiliate | `/affiliates` (program info), `/affiliate/apply`, `/affiliate/login`, `/affiliate` |
| Admin | `/admin/login`, `/admin` |

**Emails in development.** With `EMAIL_TRANSPORT=console` (the default), emails are not
sent. They are printed to the API log, marked `[DEV EMAIL — not actually sent]`, so you can
click verification, reset, purchase and sign-in links from there. Production refuses to
start with the console transport.

**Files in development.** With `STORAGE_DRIVER=local`, covers, original PDFs and rendered
pages are kept in `apps/api/storage/`. That folder is git-ignored and never served
directly. Production requires private S3-compatible storage.

### Testing payments (Razorpay test mode)

1. **Add test API keys.** In the Razorpay dashboard, switch to Test Mode and create API
   keys. Put them in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Until you do, checkout
   responds with *Payments are not configured*.
2. **Optional: set up the webhook.** Webhooks need a public URL, so expose the API with a
   tunnel such as `npx cloudflared tunnel --url http://localhost:5000` or ngrok.
   - In Razorpay → Webhooks, add `https://<tunnel>/api/v1/webhooks/razorpay`.
   - Select the events listed in `apps/api/.env.example`.
   - Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.

   Purchases still complete without webhooks, through the browser's verification call.
3. **Pay with test details.** Use the test cards or UPI IDs from Razorpay's docs. Nothing
   is charged in test mode.

### Typical first run

1. **Create a book.** Go to Admin → eBooks → **New eBook**. Fill in the details, price and
   commission, then click **Create draft**.
2. **Add the files.** Upload a cover and the PDF. Pages render in the background, with
   progress shown.
3. **Publish.** Choose the preview pages, check the table of contents, then click
   **Publish**. The book appears in the store.
4. **Buy and read.** Buy the book as a guest (test mode), open the emailed link, and read it.
5. **Try the affiliate flow.**
   - Apply at `/affiliate/apply` and approve the application in Admin → Affiliates.
   - As the affiliate, copy a referral link and open it in a private window.
   - Buy the book from that window. The commission appears in both dashboards.

## Scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Run the API / web app in watch mode |
| `npm test` | Run all test suites (API tests use an in-memory MongoDB replica set) |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | Lint the web app |
| `npm run build` | Production builds (API bundle + PDF worker via esbuild, then the Next.js build) |
| `npm run seed:admin` | Create or promote the admin from the `SEED_ADMIN_*` env vars |

## Security notes

- **Sessions and passwords.** Sessions are opaque random tokens in `HttpOnly`,
  `SameSite=Lax` cookies, and only their SHA-256 hashes are stored. Passwords use bcrypt
  (cost 12).
- **Server-side trust.** Prices, commissions, payment status and affiliate attribution are
  all computed on the server. The frontend is never trusted for any of them.
- **Payments.** Razorpay payments are verified with an HMAC check plus a server-side fetch
  of the payment. Webhooks are signature-checked and processed idempotently.
- **eBook files.** The original PDFs are kept in private storage and are never sent to
  browsers or by email. Readers get one page at a time, watermarked with their identity,
  after an entitlement check on every request.
- **Copying can't be fully stopped.** Screenshots, screen recording and manual copying
  cannot be prevented. These measures make copying harder and leaks traceable.
