# Purple Voice — Deployment, connections and updates

How Purple Voice runs on the VPS, how each outside service is connected, and how
updates ship. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Every setting:
[.env.example](.env.example).

---

## 1. What runs where

One VPS (Hostinger-style **KVM 2: 4 GB RAM, 2 vCPU**, Ubuntu 24.04):

| Process | Port | What | Memory cap |
|---|---|---|---|
| nginx | 80/443 | TLS, routing, `/uploads` from disk, edge rate limits | — |
| `pv-web` (PM2) | 127.0.0.1:3000 | Next.js: website, dashboard, admin | 800 MB |
| `pv-api` (PM2) | 127.0.0.1:4000 | Express API, carrier webhooks, live-call WebSockets | 700 MB |
| `pv-worker` (PM2) | — | campaign dialer, webhook deliveries, maintenance | 350 MB |
| PostgreSQL 16 | 127.0.0.1:5432 | the database (tuned in `deploy/postgres/purplevoice.conf`) | ~1 GB shared buffers |

Only 22, 80 and 443 are open (ufw). Node and Postgres listen on localhost only.

nginx routes (`deploy/nginx/purplevoice.conf`): `/api/*` and `/ws/*` → API,
`/uploads/*` → `storage/uploads` on disk, everything else → Next.js.

---

## 2. First-time setup

1. **DNS** — point `A` (and `AAAA`) records for `purplevoice.ai` and `www` at the VPS.
2. **Bootstrap the server** (as root, from a checkout of the repo):
   ```bash
   git clone https://github.com/Fahad-Makhdoomi/purple-voice.git /tmp/pv
   bash /tmp/pv/deploy/server-setup.sh purplevoice.ai you@purplevoice.ai
   ```
   This installs nginx, Postgres 16, Node 20, PM2 and certbot; adds 2 GB swap; enables
   the firewall; creates the `purplevoice` user, the database with a random password,
   `/etc/purple-voice/api.env` and `web.env` with freshly generated secrets; installs the
   nginx site and TLS certificate; and schedules nightly backups.
3. **Back up `APP_ENCRYPTION_KEY`** from `/etc/purple-voice/api.env` somewhere safe.
   Without it, stored API keys and carrier tokens can't be decrypted.
4. **Fill in the providers** you use in `/etc/purple-voice/api.env` (section 4 below),
   plus `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD` for the first login.
5. **Deploy** as the app user:
   ```bash
   sudo -iu purplevoice
   git clone https://github.com/Fahad-Makhdoomi/purple-voice.git /var/www/purple-voice/app
   cd /var/www/purple-voice/app && ./deploy/deploy.sh main
   ```
   Then sign in at `https://purplevoice.ai/login` with the super admin, and remove
   `SEED_SUPER_ADMIN_PASSWORD` from the env file.

> The PM2 file reads `/etc/purple-voice/*.env`, and `STORAGE_LOCAL_PATH` defaults to
> `/var/www/purple-voice/storage/uploads`, the directory nginx serves at `/uploads`.

---

## 3. Updating

```bash
sudo -iu purplevoice
cd /var/www/purple-voice/app && ./deploy/deploy.sh main      # or a tag: ./deploy/deploy.sh v1.4.0
```

`deploy.sh` pulls, installs, checks static images, builds shared → API → applies
database migrations → builds the web app, re-runs the idempotent seed (plans and first
admin only), then `pm2 startOrReload` and a health check.

- **Migrations** are created in development with `npm run db:migrate` and committed
  (`apps/api/prisma/migrations`); production only ever runs `prisma migrate deploy`.
  Write migrations additively (add, backfill, then remove in a later release) so the
  old code keeps working during the reload.
- **Live calls** — the API waits up to 30 s for calls to end on restart. Deploy
  outside peak calling hours.
- **Rollback** — `./deploy/deploy.sh <previous-tag>`. If a migration must be undone,
  restore the pre-deploy backup (section 6).
- **Content changes** (pages, blog, FAQs, SEO, plan prices) need no deploy: they are
  edited in the admin panel and go live within seconds.

---

## 4. Connecting outside services

Each entry: where to get it, where it goes, and what to check.

### Stripe (subscriptions)
1. Create two **monthly recurring prices**: Basic $19 and Pro $299. Copy their ids into
   `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO` (or paste them in Admin → Plans & pricing).
2. `STRIPE_SECRET_KEY` = the secret key (live mode in production).
3. Add a webhook endpoint `https://purplevoice.ai/api/billing/webhook` for
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable the **Customer portal** (Settings → Billing → Customer portal) so subscribers
   can update cards, download invoices and cancel.
5. Enterprise deals are billed however you agree; record them in Admin → Subscribers →
   *Subscription* (plan Enterprise, custom price, minutes and limits).

### Twilio and Plivo (customers' phone numbers)
Nothing to configure on the platform side. Each subscriber connects **their own**
account under Dashboard → Phone numbers:
- Twilio: Account SID + Auth Token. Purple Voice sets the number's *A call comes in*
  webhook and status callback automatically and streams audio over Media Streams.
- Plivo: Auth ID + Auth Token. Purple Voice creates one Plivo Application per number
  and attaches it.
- **Re-sync** on a number re-applies the webhooks — use it after a domain change.
- The VPS must be reachable over HTTPS on the public domain; carriers call
  `/api/telephony/*` and open WebSockets to `/ws/*`.

### SuperPhone
Accounts and numbers can be saved, but AI calling through SuperPhone is pending its
voice-streaming API (see ARCHITECTURE.md § 21). Until then, forward the SuperPhone
number to a connected Twilio or Plivo number.

### AI providers (customers' keys)
Subscribers add their own keys under Dashboard → Integrations; each key is verified with
one request before it's encrypted and saved.
- **OpenAI** — required for the Realtime engine (speech-to-speech).
- **Claude (Anthropic)**, **Gemini** — models for the Cascaded engine.
- **Deepgram** — speech-to-text and voices for the Cascaded engine.

The platform's own Claude key, `ANTHROPIC_API_KEY`, powers only the Pro AI support
assistant and the CMS "Draft with AI" button. `ASSISTANT_MODEL` picks the model.

### Google Calendar (appointment booking)
1. Google Cloud Console → create a project → enable the **Google Calendar API**.
2. OAuth consent screen: External, add scopes `calendar.events` and `calendar.freebusy`.
   Publishing the app for all users requires Google's verification of those scopes.
3. Credentials → OAuth client (Web application). Authorised redirect URI:
   `https://purplevoice.ai/api/integrations/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Subscribers then click
   **Connect** under Integrations and link the calendar to an agent.

### Email (SMTP)
Any SMTP provider (Postmark, Amazon SES, Mailgun, Zoho, Google Workspace relay):
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Add the
provider's SPF and DKIM records to the domain. Used for password resets, support replies,
lead and ticket notifications (`SUPPORT_NOTIFY_EMAILS`) and email automations.

### Captcha
1. Pick a provider and create a site: **Cloudflare Turnstile** (recommended: free,
   privacy-friendly), Google **reCAPTCHA v3**, or **hCaptcha**.
2. API env: `CAPTCHA_PROVIDER=turnstile|recaptcha|hcaptcha`, `CAPTCHA_SECRET_KEY`
   (and `CAPTCHA_MIN_SCORE` for reCAPTCHA). Web env: `NEXT_PUBLIC_CAPTCHA_SITE_KEY`.
   Rebuild the web app after changing the site key (it's compiled in).
3. Choose which forms require it in **Admin → Security** (sign-up, sign-in, forgot
   password, contact). The CSP already allows all three providers.

### Website analytics
Admin → SEO & analytics: Plausible domain and/or GA4 measurement id. Both load after
the page is interactive. Google Search Console verification is set on the same page.

### Object storage (optional)
For off-server media, set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT`
(e.g. `https://<account>.r2.cloudflarestorage.com`), `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY` and `STORAGE_PUBLIC_URL` (the bucket's public/custom domain).
Existing local files keep their URLs; copy them to the bucket if you move.

### Developer webhooks, API and Zapier
Customer-facing; no platform configuration. Outgoing requests to customer URLs are
blocked from private networks.

---

## 5. Go-live checklist

- [ ] DNS, TLS (`https://` loads, `www` redirects), `curl https://purplevoice.ai/api/health`
- [ ] `APP_ENCRYPTION_KEY` backed up off the server
- [ ] Super admin can sign in; seed password removed from the env file
- [ ] Stripe: test-mode checkout → webhook marks the plan active → portal opens; then switch to live keys
- [ ] SMTP: forgot-password email arrives
- [ ] Twilio test number: connect, test-call an agent, check transcript, summary and billed minutes
- [ ] Plivo (if offered): same
- [ ] Realtime agent with an OpenAI key; Cascaded agent with Claude + Deepgram
- [ ] Google Calendar: connect, book from a test call, event appears with invite
- [ ] Captcha on, and each protected form submits
- [ ] Legal pages (privacy, terms) reviewed by counsel and published
- [ ] PageSpeed Insights on the live home page ≥ 90 (mobile)
- [ ] Backups: run `/usr/local/bin/purple-voice-backup` once and test a restore

---

## 6. Backups and restore

Nightly at 03:15 (`/etc/cron.d/purple-voice-backup`): a `pg_dump` custom-format dump and a
tarball of `storage/uploads`, kept 14 days in `/var/backups/purple-voice`. **Copy them off
the server** too (e.g. `rclone` to R2/S3/B2 in the same cron).

Restore:
```bash
pm2 stop all
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" /var/backups/purple-voice/db_<stamp>.dump
tar -xzf /var/backups/purple-voice/uploads_<stamp>.tar.gz -C /var/www/purple-voice/storage
pm2 start all
```

---

## 7. Monitoring and capacity

- Health: `GET /api/health` (checks the database). Point an uptime monitor at it.
- Logs: `pm2 logs pv-api`, `pm2 logs pv-worker`, `pm2 logs pv-web`; nginx in
  `/var/log/nginx/`. API logs are JSON (pino); secrets are redacted.
- Admin → Overview shows live calls and calls in the last 24 h.

**Capacity on KVM 2.** Audio passes through without transcoding, so each live call costs
two WebSockets and some JSON. Our estimate is **roughly 40–60 concurrent calls** before CPU
becomes the limit — load-test with your own traffic before relying on it. Plan concurrency caps (Basic 2, Pro 10, Enterprise 50) keep one customer from
using it all. When you approach that:
1. move Postgres to a managed database (frees ~1.2 GB and a core);
2. move media to object storage;
3. run a second VPS for `pv-api` behind nginx, or a bigger plan. Keep exactly one `pv-worker`.

---

## 8. Local development

```bash
cp .env.example apps/api/.env          # keep the API block
cp .env.example apps/web/.env.local    # keep the Web block
docker compose up -d                   # Postgres :5434, Mailpit :8025
npm install
npm run db:migrate && npm run db:seed  # prints the super admin and demo logins
npm run dev                            # web :3000, api :4000, worker
```

Demo logins after seeding: `demo@purplevoice.local` / `demo-password-1` (Pro workspace
with sample calls) and the super admin from `SEED_SUPER_ADMIN_*`.

To receive real calls locally, expose the API with a tunnel (`ngrok http 4000` or
`cloudflared tunnel --url http://localhost:4000`) and set `PUBLIC_API_URL` to the tunnel
URL, then Re-sync your test number.

---

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| Number shows *Needs attention* | The error under it; carrier credentials still valid; click Re-sync after domain changes. |
| Call connects then silence | `pm2 logs pv-api` for "Could not start voice engine": a missing AI or Deepgram key, or an invalid model id on the agent. |
| Calls never finalise / no summaries | Carrier status callbacks reaching `/api/telephony/*/status` (nginx access log); the maintenance sweep finalises stragglers within minutes. |
| Plan not active after paying | Stripe → Webhooks → recent deliveries to `/api/billing/webhook`; the signing secret matches. |
| CMS edits not showing | `REVALIDATE_SECRET` identical in both env files; `WEB_INTERNAL_URL` reachable from the API. |
| "Cross-site request blocked" | `APP_URL` / `CORS_ORIGINS` must exactly match the site origin (scheme and host). |
| Captcha never appears | `NEXT_PUBLIC_CAPTCHA_SITE_KEY` set before the web build; provider set in the API env; form enabled in Admin → Security. |
