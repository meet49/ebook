# Deploying ReadnShare on Render (readnshare.in)

You will create **two Render web services** from this repo, plus three external services
the app needs in production.

| What | Where | Why |
|---|---|---|
| `readnshare-web` | Render (Starter), on **readnshare.in** | The Next.js website users visit |
| `readnshare-api` | Render (Standard, 2 GB) | Express API. PDF rendering needs memory |
| Database | MongoDB Atlas | Persistent data |
| File storage | Cloudflare R2 (or AWS S3) | Covers, PDFs and rendered pages. Render's disk is wiped on every deploy |
| Email | Brevo, Resend, Postmark or SES (SMTP) | Verification, purchase and sign-in emails |

Visitors only ever use `https://readnshare.in`. The website forwards `/api/*` to the API
service, so the API does not need its own domain.

> **Why not Render's free plan?** Free services sleep after inactivity (slow first load,
> delayed webhooks) and **block outgoing email (SMTP) ports**. Use paid plans for both.
>
> **Free (Hobby) workspace bandwidth.** All services in the workspace share 5 GB of outbound
> bandwidth a month. With no card on file, Render suspends every free service once it runs out,
> until the start of the next month. See each service's **Metrics → Outbound bandwidth**, and
> delete services you no longer use. The app keeps its own share small: JSON is compressed,
> the website's CDN keeps covers, and each buyer's browser keeps their copy of a book.

---

## Step 1 — MongoDB Atlas

1. Use your existing cluster, or create one at <https://cloud.mongodb.com>. Choose region
   **AWS Mumbai (ap-south-1)** or Singapore.
2. **Database Access** → create a database user with a strong password.
3. **Network Access** → *Add IP Address* → `0.0.0.0/0`. Render's outgoing IPs change
   unless you use a paid static-IP add-on; the password protects the cluster.
4. **Connect → Drivers** → copy the connection string. **Add the database name**
   `/readnshare` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/readnshare?retryWrites=true&w=majority
   ```

## Step 2 — File storage (Cloudflare R2)

1. Cloudflare dashboard → **R2** → *Create bucket* → name `readnshare-private`. Keep it
   **private**: do not enable a public URL.
2. R2 → **Manage API tokens** → *Create API token* → permission **Object Read & Write**,
   scoped to that bucket.
3. Note these values:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_BUCKET` = `readnshare-private`
   - `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` = from the token
   - `S3_REGION` = `auto` (already set in `render.yaml`)

   *(For AWS S3 instead: use the bucket's region, e.g. `ap-south-1`. Leave
   `S3_ENDPOINT` empty and set `S3_FORCE_PATH_STYLE=false`.)*

## Step 3 — Email (SMTP)

Any transactional provider works. With **Brevo** (generous free tier):
1. Brevo → **SMTP & API** → *SMTP*: note the host `smtp-relay.brevo.com`, port `587`,
   login and SMTP key.
2. **Senders & Domains** → add and authenticate `readnshare.in`. It gives you SPF, DKIM
   and DMARC DNS records; add them at your domain's DNS (see Step 5).
3. Values: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and
   `EMAIL_FROM` = `ReadnShare <no-reply@readnshare.in>`.

## Step 4 — Create the services on Render (Blueprint)

1. Render dashboard → **New → Blueprint** → connect GitHub → choose `meet49/ebook`.
   Render reads `render.yaml` and proposes both services. The domain values are already
   set there:
   - `APP_URL=https://readnshare.in`
   - `ALLOWED_ORIGINS=https://www.readnshare.in`
   - `NEXT_PUBLIC_SITE_URL=https://readnshare.in`
   - `readnshare.in` is attached to `readnshare-web`.
2. Render asks only for the secret values (`sync: false`):

   **readnshare-api**
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | from Step 1 |
   | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from Step 2 |
   | `EMAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | from Step 3 |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | leave empty (add in Admin → Settings later) |

   **readnshare-web**
   | Key | Value |
   |---|---|
   | `API_URL` | `https://readnshare-api.onrender.com`: the API service's onrender address. If Render added a suffix because the name was taken, use the exact URL shown on the API service |

   `APP_SECRET` is generated automatically. **Never change it after launch**: it encrypts
   affiliate bank details and saved Razorpay keys.
3. Click **Apply**. The first build takes about 5–8 minutes per service.
4. Check the API: `https://readnshare-api.onrender.com/api/health` →
   `{"status":"ok","db":"up"}`.

If the API fails to start, open its **Logs**. The app validates its configuration at boot
and prints exactly which variable is missing or wrong (for example "SMTP_HOST is
required" or "Use private S3-compatible storage in production").

> `API_URL` is used when the website **builds**. If you change it later, use **Manual
> Deploy → Clear build cache & deploy** on `readnshare-web`.

## Step 5 — Point readnshare.in to Render (DNS)

1. Render → `readnshare-web` → **Settings → Custom Domains**. `readnshare.in` should be
   listed (if not, click *Add Custom Domain* and enter it). Render also adds
   `www.readnshare.in` and redirects between the two. **Use the exact DNS records Render
   shows on that page.**
2. Where your domain's DNS is managed (GoDaddy, Hostinger, BigRock, Namecheap,
   Cloudflare, ...):
   - **Delete** any existing `A` / `AAAA` records for `@` and any old `www` record (for
     example from domain parking or an old site).
   - Add an **A** record: name `@` → the IP Render shows (commonly `216.24.57.1`).
   - Add a **CNAME** record: name `www` → `readnshare-web.onrender.com` (your web
     service's onrender address).
   - Add the email records from Step 3 (SPF, DKIM, DMARC).
   - Using **Cloudflare** DNS? Set the `@` and `www` records to **DNS only** (grey
     cloud), at least until Render has issued the certificate.
3. Back in Render, click **Verify**. DNS usually updates within minutes but can take up to
   24–48 hours. Render then issues the HTTPS certificate automatically.
4. Check:
   - `https://readnshare.in` → the home page
   - `https://readnshare.in/api/health` → `{"status":"ok","db":"up"}` (the website → API
     proxy works)
   - `https://www.readnshare.in` → redirects to the main address

## Step 6 — Create the first admin

Run once, from your computer, against the **production** database (PowerShell, in the
project folder):

```powershell
$env:MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/readnshare?retryWrites=true&w=majority"
$env:APP_SECRET = "any-temporary-value-at-least-32-characters-long"
$env:SEED_ADMIN_EMAIL = "you@readnshare.in"
$env:SEED_ADMIN_PASSWORD = "A-strong-password-123"
$env:SEED_ADMIN_NAME = "Your Name"
$env:DNS_SERVERS = "8.8.8.8,1.1.1.1"
npm run seed:admin
```

Then sign in at `https://readnshare.in/admin/login`. Close the PowerShell window
afterwards so the password does not stay in the session.

## Step 7 — Razorpay (from the admin dashboard)

1. Razorpay dashboard → switch to **Test Mode** → *Account & Settings → API Keys* →
   generate keys.
2. Razorpay → *Webhooks* → **Add New Webhook**:
   - URL: `https://readnshare.in/api/v1/webhooks/razorpay` (also shown in Admin → Settings)
   - Secret: choose a long random string
   - Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.created`,
     `refund.processed`, `refund.failed`
3. ReadnShare → **Admin → Settings** → enter the Key ID, Key Secret and webhook secret,
   plus your admin password → **Verify & save**.
4. Make a test purchase: Razorpay's test cards and UPI IDs charge nothing.
5. When everything works, switch to **Live Mode**:
   - Razorpay's live activation asks for your website: give `https://readnshare.in`.
     The Terms, Privacy and Refund pages (`/legal/terms`, `/legal/privacy`,
     `/legal/refunds`) must be reachable.
   - Then repeat steps 1–3 with the live keys and a live-mode webhook.

## Step 8 — Check client IPs (rate limits)

Rate limits and the audit log use the visitor's IP. Requests pass through Render's proxy
twice (web → API), so `render.yaml` sets `TRUST_PROXY=2`. After a few sign-ins, open
**Admin → Audit log**:
- **Your own public IP** appears → it's correct.
- **The same internal IP appears for every visitor** → set `TRUST_PROXY=3` on the API.
- **Values you can change by sending your own `X-Forwarded-For` header** → lower it.

## Changing the domain later

1. Change `domains` in `render.yaml` (or Render → Custom Domains) and set up DNS.
2. Update `APP_URL` and `ALLOWED_ORIGINS` (API) and `NEXT_PUBLIC_SITE_URL` (web). Redeploy
   both, using **Clear build cache & deploy** for the website.
3. Update the Razorpay webhook URL.

## Updating the site

Every `git push` to `main` redeploys both services automatically (`autoDeploy: true`).
Run the checks locally first: `npm run typecheck && npm test`.

## Before going live

Work through [DEPLOYMENT.md](DEPLOYMENT.md) → "Go-live verification", and have the legal
pages reviewed.
