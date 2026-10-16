# Deploying ReadnShare on Render

You will create **two Render web services** from this repo, plus three external services
the app needs in production.

| What | Where | Why |
|---|---|---|
| `readnshare-web` | Render (Starter) | The Next.js website users visit |
| `readnshare-api` | Render (Standard, 2 GB) | Express API. PDF rendering needs memory |
| Database | MongoDB Atlas | Persistent data |
| File storage | Cloudflare R2 (or AWS S3) | Covers, PDFs and rendered pages. Render's disk is wiped on every deploy |
| Email | Brevo, Resend, Postmark or SES (SMTP) | Verification, purchase and sign-in emails |

> **Why not Render's free plan?** Free services sleep after inactivity (slow first load,
> delayed webhooks) and **block outgoing email (SMTP) ports**. Use paid plans for both.

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
2. Add and verify your sending domain (SPF/DKIM) or sender address.
3. Values: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and
   `EMAIL_FROM="ReadnShare <no-reply@yourdomain.com>"`.

## Step 4 — Create the services on Render (Blueprint)

1. Render dashboard → **New → Blueprint** → connect GitHub → choose `meet49/ebook`.
   Render reads `render.yaml` and proposes both services.
2. Render asks for each `sync: false` value. First you need to know the two public URLs:
   they are `https://<service-name>.onrender.com`, so by default:
   - Web: `https://readnshare-web.onrender.com`
   - API: `https://readnshare-api.onrender.com`

   (If a name is taken, Render adds a suffix. Check the URL shown on each service and
   update the values below to match.)
3. Fill in:

   **readnshare-api**
   | Key | Value |
   |---|---|
   | `APP_URL` | `https://readnshare-web.onrender.com` (the **website** URL) |
   | `MONGODB_URI` | from Step 1 |
   | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from Step 2 |
   | `EMAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | from Step 3 |
   | `RAZORPAY_*` | leave empty for now (add in Admin → Settings later) |

   `APP_SECRET` is generated automatically. **Never change it after launch**: it encrypts
   affiliate bank details and saved Razorpay keys.

   **readnshare-web**
   | Key | Value |
   |---|---|
   | `API_URL` | `https://readnshare-api.onrender.com` (the **API** URL) |
   | `NEXT_PUBLIC_SITE_URL` | `https://readnshare-web.onrender.com` |

4. Click **Apply**. The first build takes about 5–8 minutes per service.
5. Check:
   - `https://readnshare-api.onrender.com/api/health` → `{"status":"ok","db":"up"}`
   - `https://readnshare-web.onrender.com` → the home page
   - `https://readnshare-web.onrender.com/api/health` → the same JSON (the web → API
     proxy works)

If the API fails to start, open its **Logs**. The app validates its configuration at boot
and prints exactly which variable is missing or wrong (for example "SMTP_HOST is
required" or "Use private S3-compatible storage in production").

> `API_URL` is used when the website **builds**. If you change it later, use **Manual
> Deploy → Clear build cache & deploy** on `readnshare-web`.

## Step 5 — Create the first admin

Run once, from your computer, against the **production** database (PowerShell, in the
project folder):

```powershell
$env:MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/readnshare?retryWrites=true&w=majority"
$env:APP_SECRET = "any-temporary-value-at-least-32-characters-long"
$env:SEED_ADMIN_EMAIL = "you@yourdomain.com"
$env:SEED_ADMIN_PASSWORD = "A-strong-password-123"
$env:SEED_ADMIN_NAME = "Your Name"
npm run seed:admin
```

(If your network refuses the `mongodb+srv` lookup, also set
`$env:DNS_SERVERS = "8.8.8.8,1.1.1.1"`.) Then sign in at
`https://readnshare-web.onrender.com/admin/login`.

## Step 6 — Razorpay (from the admin dashboard)

1. Razorpay dashboard → switch to **Test Mode** → *Account & Settings → API Keys* →
   generate keys.
2. Razorpay → *Webhooks* → **Add New Webhook**:
   - URL: `https://readnshare-web.onrender.com/api/v1/webhooks/razorpay`
     (also shown in Admin → Settings)
   - Secret: choose a long random string
   - Events: `payment.captured`, `order.paid`, `payment.failed`, `refund.created`,
     `refund.processed`, `refund.failed`
3. ReadnShare → **Admin → Settings** → enter the Key ID, Key Secret and webhook secret,
   plus your admin password → **Verify & save**.
4. Make a test purchase: Razorpay's test cards and UPI IDs charge nothing.
5. When everything works, repeat steps 1–3 with **Live Mode** keys.

## Step 7 — Check client IPs (rate limits)

Rate limits and the audit log use the visitor's IP. Requests pass through Render's proxy
twice (web → API), so `render.yaml` sets `TRUST_PROXY=2`. After a few sign-ins, open
**Admin → Audit log**:
- **Your own public IP** appears → it's correct.
- **The same internal IP appears for every visitor** → try `TRUST_PROXY=3`.
- **Values you can change by sending your own `X-Forwarded-For` header** → lower it.

## Step 8 — Custom domain (optional)

1. `readnshare-web` → **Settings → Custom Domains** → add `readnshare.com` and
   `www.readnshare.com`, then create the DNS records Render shows.
2. Update `APP_URL` (API) and `NEXT_PUBLIC_SITE_URL` (web) to `https://readnshare.com`.
   Redeploy both, clearing the web build cache.
3. Update the Razorpay webhook URL to the new domain.

## Updating the site

Every `git push` to `main` redeploys both services automatically (`autoDeploy: true`).
Run the checks locally first: `npm run typecheck && npm test`.

## Before going live

Work through [DEPLOYMENT.md](DEPLOYMENT.md) → "Go-live verification", and have the legal
pages reviewed.
