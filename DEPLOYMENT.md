# Purple Voice — Deployment, connections and updates

How Purple Voice runs on the VPS, how each outside service is connected, and how
updates ship. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Every setting:
[.env.example](.env.example).

---

## 1. What runs where

One VPS (Hostinger-style **KVM 2: 4 GB RAM, 2 vCPU**), either managed by CloudPanel or
plain Ubuntu 24.04 (section 2):

| Process | Port | What | Memory cap |
|---|---|---|---|
| nginx | 80/443 | TLS, routing, `/uploads` from disk, edge rate limits | — |
| `pv-web` (PM2) | 127.0.0.1:3000 | Next.js: website, dashboard, admin | 800 MB |
| `pv-api` (PM2) | 127.0.0.1:4000 | Express API, carrier webhooks, live-call WebSockets | 700 MB |
| `pv-worker` (PM2) | — | campaign dialer, webhook deliveries, maintenance | 350 MB |
| PostgreSQL 16 | 127.0.0.1:5432 | the database (tuned in `deploy/postgres/purplevoice.conf`) | ~1 GB shared buffers |

Only 22, 80 and 443 are open (plus 8443 for the CloudPanel UI). Node and Postgres listen
on localhost only.

nginx routes (`deploy/cloudpanel/vhost.conf` or `deploy/nginx/purplevoice.conf`):
`/api/*` and `/ws/*` → API, `/uploads/*` → uploads on disk, `/internal/*` → 404,
everything else → Next.js.

---

## 2. First-time setup

Two ways to run it: **2A** on a server managed by CloudPanel (production:
`voice.purplerocket.co`), or **2B** on a bare Ubuntu server where these scripts manage
nginx and TLS themselves. Both need Node.js 22+.

### 2A. CloudPanel

CloudPanel owns nginx, TLS and the site user; `deploy/cloudpanel/setup.sh` adds the
database, the env files, PM2 and backups around it.

**PostgreSQL.** If the server already runs PostgreSQL for other apps, the script uses
it as it is: it adds a `purple_voice` role and database and does **not** change that
server's settings or restart it. Purple Voice holds up to ~20 connections (API and
worker, 10 each), so the server's `max_connections` needs that much headroom. Only on
a server without PostgreSQL does it install PostgreSQL 16 and tune it. A PostgreSQL
running in Docker or elsewhere: create a role and database yourself and pass
`PV_DATABASE_URL='postgresql://…/purple_voice'` to the script. CloudPanel's own
database (MySQL, port 3306) is not used.

| What | Where |
|---|---|
| Code | `/home/<site-user>/purple-voice` (outside `htdocs`, so nginx never serves it) |
| Env files | `/home/<site-user>/.purple-voice/api.env`, `web.env` (mode 600) |
| Uploaded media | `/home/<site-user>/htdocs/<domain>/uploads` (served by nginx at `/uploads/`) |
| Backups | `/home/<site-user>/backups/purple-voice` |
| Processes | PM2 as the site user, started on boot by `pm2-<site-user>.service` |

1. **DNS**: an `A` record for `voice` in the `purplerocket.co` zone → the VPS IP. If the zone is on
   Cloudflare, keep the record **DNS only** (grey cloud) so Let's Encrypt, carrier
   WebSockets and per-IP rate limits see the real client.
2. **CloudPanel → Sites → Add Site → Create a Node.js Site**: domain
   `voice.purplerocket.co`, Node.js **22**, App Port **3000**, and a site user (e.g.
   `purplerocket-voice`) with a strong password. The App Port must be 1024 or above (the
   app doesn't run as root) and must not be 3306 (MySQL) or 5432 (PostgreSQL). Once the
   vhost from step 5 is pasted, nginx uses the setup script's port (3000) whatever the
   App Port says.
3. **Put the code on the server** as the site user (SSH or SFTP with the site user):
   - from GitHub: `git clone git@github.com:Fahad-Makhdoomi/purple-voice.git ~/purple-voice`
     (add `~/.ssh/id_ed25519.pub` as a read-only *deploy key* on the repo first), or
   - from the source tarball: upload `purple-voice-source.tar.gz` to the site user's home
     (CloudPanel File Manager or SFTP), then `cd ~ && tar -xzf purple-voice-source.tar.gz`.

   Either way, [Automatic deploys from GitHub](#automatic-deploys-from-github) (after
   step 9) turns it into a checkout that updates itself on every push.
4. **Run the setup as root** (root SSH, or your VPS provider's browser terminal):
   ```bash
   bash /home/purplerocket-voice/purple-voice/deploy/cloudpanel/setup.sh \
     purplerocket-voice voice.purplerocket.co you@your-domain.com
   ```
   It creates the database (see **PostgreSQL** above), writes the env files with fresh
   secrets, installs PM2 with a boot service, schedules nightly backups, runs the first
   deploy, and writes `~/purple-voice-vhost.conf`. Re-running it is safe.
5. **CloudPanel → Sites → voice.purplerocket.co → Vhost**: paste the two parts of
   `~/purple-voice-vhost.conf` as its header explains (part 1 above `server {`, part 2 in
   place of CloudPanel's `location / { … }` block) and save. This routes `/api`, `/ws`
   and `/uploads`, blocks `/internal`, and adds edge rate limits.
6. **SSL/TLS → Actions → New Let's Encrypt Certificate.**
7. **Sign in** with the details in `~/.purple-voice/first-login.txt`, change the password
   in **Admin → Your account**, then delete that file.
8. **Back up `APP_ENCRYPTION_KEY`** from `~/.purple-voice/api.env` to a password manager.
   Without it, stored API keys and carrier tokens can't be decrypted.
9. **Fill in the providers** you use in `~/.purple-voice/api.env` (section 4), then
   redeploy: `cd ~/purple-voice && ./deploy/deploy.sh`.

### Automatic deploys from GitHub

Once this is set up, every push to `main` that passes CI goes live by itself:

```
git push ─▶ CI (ci.yml) ─▶ Deploy (deploy.yml) ─ssh─▶ deploy/remote-deploy.sh ─▶ deploy/deploy.sh <sha>
```

- **Deploy** runs only after a green CI run of a push to `main`, and deploys exactly the
  commit CI tested. If `main` has moved on by then, that older commit is skipped (a
  notice says so): the newer one deploys after its own CI run, so production never
  goes backwards.
- On the server, `deploy.sh` checks out that commit and then does everything in
  section 3, **including the database migrations**.
- One deploy at a time: GitHub queues them, and the server holds a lock as well. A
  deploy the server has started finishes even if the GitHub job is cancelled or the
  connection drops.

**One-time setup** (production: `62.72.57.2`, site user `purplerocket-voice`):

1. **Create the repository and push.** On GitHub create the private repository
   `Fahad-Makhdoomi/purple-voice`, empty (no README or licence). From the project on
   your computer: `git push -u origin main` (add the remote first if `git remote -v`
   doesn't show it: `git remote add origin git@github.com:Fahad-Makhdoomi/purple-voice.git`).
   CI runs; Deploy runs after it and fails with *Deploy secrets missing* until
   step 4. That is expected.
2. **Run the setup on the server**, as the site user (SSH in as `purplerocket-voice`;
   not as root):
   ```bash
   bash ~/purple-voice/deploy/cloudpanel/enable-auto-deploy.sh Fahad-Makhdoomi/purple-voice 62.72.57.2
   ```
   The code on the server must include this script. If it came from a tarball made
   before automatic deploys existed, extract the new tarball over it first
   (`cd ~ && tar -xzf purple-voice-source.tar.gz`).

   The first run creates a read-only deploy key for the repository, prints it, and
   stops.
3. **Add the deploy key on GitHub**: repository → Settings → Deploy keys → Add deploy
   key, paste it, and leave *Allow write access* unticked. Then run the command from
   step 2 again. This time it:
   - turns `~/purple-voice` into a git checkout of `main` if it isn't one: a copy of
     the old files goes to `~/purple-voice-before-git-<time>.tar.gz`, files the
     repository doesn't have are removed, and `node_modules`, builds and the env files
     (in `~/.purple-voice`) stay;
   - creates the key GitHub Actions logs in with, allows it to run the deploy and
     nothing else, and checks that over SSH;
   - prints the values for step 4. **The private key is shown once and then deleted
     from the server**, so paste it into GitHub straight away.

   The site keeps running the build it had until the first deploy.
4. **Add the secrets**: repository → Settings → Secrets and variables → Actions → New
   repository secret.

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | `62.72.57.2` |
   | `DEPLOY_USER` | `purplerocket-voice` |
   | `DEPLOY_SSH_KEY` | the private key the script printed, `BEGIN` and `END` lines included |
   | `DEPLOY_KNOWN_HOSTS` | the `62.72.57.2 ssh-ed25519 AAAA…` line it printed (the server's host key, so the runner never trusts an unknown one) |
   | `DEPLOY_PORT` | only if SSH listens on a port other than 22 |

   Optionally, on the **Variables** tab: `DEPLOY_HEALTHCHECK_URL` =
   `https://voice.purplerocket.co/api/health`. A deploy then fails unless the public
   site answers 200 through nginx and TLS (deploy.sh already checks the app directly).
5. **Optional, paid GitHub plans: an approval step.** To make every deploy wait for
   a click, create an environment (Settings → Environments → `production`, deployment
   branches `main` only, required reviewers), move the four secrets onto it, and add
   `environment: production` under `deploy:` in `.github/workflows/deploy.yml`.
   Environments in private repositories need a paid GitHub plan, so the workflow
   doesn't use one by default.
6. **Try it**: Actions → Deploy → Run workflow → `main`. From then on, just push.
   Until the secrets are added, automatic runs skip with an "Auto-deploy not set up"
   notice instead of failing.

**Watching a deploy.** GitHub → Actions → Deploy streams the server's output. On the
server, `tail -f ~/.purple-voice/deploy.log` has every deploy, timestamped (trimmed
to the newest 2 MB once it passes 5 MB).

**Rolling back.** Actions → Deploy → Run workflow, and enter an earlier tag or commit
SHA (`v1.4.0`, `3f2c1ab`). Manual runs skip the CI gate. Migrations are not undone
(section 3, *Rollback*), and the next push to `main` deploys `main` again.

**Security.**
- The CI key's line in `~/.ssh/authorized_keys` is
  `restrict,command="… deploy/remote-deploy.sh"`. Whatever its holder asks for, sshd
  runs that script, which accepts only `deploy <40-character SHA>`: no shell, no file
  transfer, no port forwarding. A leaked `DEPLOY_SSH_KEY` can only redeploy commits
  already on GitHub. Replace it with `enable-auto-deploy.sh … --rotate-ci-key` (and
  update the secret).
- The server reads the repository with a read-only deploy key that works for this
  repository only. GitHub's host key is added only after it matches GitHub's
  published fingerprint.
- Anyone who can push to `main` can run code on the server: `deploy.sh`, the npm
  scripts and `remote-deploy.sh` all come from the repository. Protect `main`
  (Settings → Branches: require pull requests and the *CI* check).
- Env files live only in `~/.purple-voice` and are never committed (`.gitignore`
  covers `.env` files). Deploys don't touch them.
- The server runs the `remote-deploy.sh` from its current checkout, so a change to it
  applies from the deploy after the one that ships it. CI checks that the deploy
  scripts parse, because a broken one stops automatic deploys until fixed by hand.

**When a deploy fails**

| Symptom | Fix |
|---|---|
| *Deploy secrets missing* | Step 4. |
| *SSH login failed* (exit 255) | Check the four secrets. If the CI key's line is gone from `~/.ssh/authorized_keys` (for example after editing SSH keys in CloudPanel), re-run the setup with `--rotate-ci-key` and update `DEPLOY_SSH_KEY`. |
| *Not deployed: main has moved on* | Expected; the newer commit deploys after its own CI run. |
| `Permission denied (publickey)` while fetching | The deploy key was removed on GitHub: re-run the setup and add it again. |
| *Deploy failed* (deploy.sh exited non-zero) | The job output and `~/.purple-voice/deploy.log` show the step. Fix and push, or roll back. |

For a manual deploy on the server that waits for any automatic one, use
`flock ~/.purple-voice/deploy.lock ./deploy/deploy.sh main`. On a bare Ubuntu server
(2B) the same setup works as the `purplevoice` user with
`PV_APP_DIR=/var/www/purple-voice/app`, provided that user can log in over SSH with a
key.

### 2B. Bare Ubuntu 24.04

1. **DNS**: point `A` (and `AAAA`) records for the domain and `www` at the VPS.
2. **Bootstrap the server** (as root, from a checkout of the repo):
   ```bash
   git clone https://github.com/Fahad-Makhdoomi/purple-voice.git /tmp/pv
   bash /tmp/pv/deploy/server-setup.sh purplevoice.ai you@purplevoice.ai
   ```
   This installs nginx, Postgres 16, Node 22, PM2 and certbot; adds 2 GB swap; enables
   the firewall; creates the `purplevoice` user, the database with a random password,
   `/etc/purple-voice/api.env` and `web.env` with freshly generated secrets; installs the
   nginx site and TLS certificate; and schedules nightly backups.
3. **Back up `APP_ENCRYPTION_KEY`** from `/etc/purple-voice/api.env` somewhere safe.
4. **Fill in the providers** you use in `/etc/purple-voice/api.env` (section 4 below),
   plus `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD` for the first login.
5. **Deploy** as the app user:
   ```bash
   sudo -iu purplevoice
   git clone https://github.com/Fahad-Makhdoomi/purple-voice.git /var/www/purple-voice/app
   cd /var/www/purple-voice/app && ./deploy/deploy.sh main
   ```
   Then sign in at `/login` with the super admin, and remove
   `SEED_SUPER_ADMIN_PASSWORD` from the env file.

> `deploy.sh`, `backup.sh` and the PM2 file find the env files on their own:
> `$PV_ENV_DIR`, else `~/.purple-voice` (2A), else `/etc/purple-voice` (2B). Ports come
> from the env files: `PORT` in `web.env` (default 3000), `API_PORT` in `api.env` (4000).

---

## 3. Updating

**With automatic deploys** ([set up in 2A](#automatic-deploys-from-github)): push to
`main`. When CI passes, the Deploy workflow puts that exact commit live; follow it in
GitHub → Actions → Deploy. To deploy a branch, tag or commit by hand, or roll back:
Actions → Deploy → Run workflow.

**By hand**, as the app user (CloudPanel: the site user over SSH; bare Ubuntu:
`sudo -iu purplevoice`):
```bash
cd ~/purple-voice && ./deploy/deploy.sh main      # or a tag or commit: ./deploy/deploy.sh v1.4.0
```

`deploy.sh` first makes the checkout match GitHub exactly: a branch is reset to
GitHub's copy (so force-pushes deploy too), a tag or commit is checked out detached,
and edits to tracked files on the server are discarded. It then carries on with that
commit's own `deploy.sh`. Without a `.git` directory (code from a tarball: extract the
new one over the old first) that step is skipped. Then it installs, checks static
images, builds shared → API, applies database migrations, re-runs the idempotent seed
(plans and first admin only), reloads the API and worker, builds the web app against
the running API so static pages carry live content, reloads the web app, and runs a
health check. The site can return errors for the minute or two the web build takes,
so deploy at a quiet time; with automatic deploys, that means pushing to `main` at a
quiet time.

- **Migrations** are created in development with `npm run db:migrate` and committed
  (`apps/api/prisma/migrations`); production only ever runs `prisma migrate deploy`,
  in every deploy, automatic ones included. Write migrations additively (add,
  backfill, then remove in a later release) so the old code keeps working during the
  reload, and run `deploy/backup.sh` before pushing a risky one.
- **Live calls** — the API waits up to 30 s for calls to end on restart. Deploy
  outside peak calling hours.
- **Rollback** — Actions → Deploy → Run workflow with the previous tag or commit SHA,
  or `./deploy/deploy.sh <previous-tag>` on the server. If a migration must be undone,
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

### AI providers (chosen by staff, never by subscribers)
Subscribers don't see or choose AI vendors, models or keys. Staff set it up:

1. **Platform keys** — Super admin → **AI providers**. Add the keys Purple Voice pays
   for; each is verified with one request before it's encrypted and saved:
   - **Gemini** (Google AI Studio → API key) — the Gemini Live engine, and summaries
     for Gemini Live calls. This is all the default setup needs.
   - **OpenAI** — the OpenAI Realtime engine, and summaries for it.
   - **Claude (Anthropic)** — the Cascaded engine with Claude, plus the Pro AI support
     assistant and the CMS "Draft with AI" button. Without a saved key these fall back
     to `ANTHROPIC_API_KEY` in api.env. `ASSISTANT_MODEL` picks the assistant's model.
   - **Deepgram** — speech-to-text and voices for the Cascaded engine only.
2. **Default AI for subscribers** — on the same page: engine, vendor and model used by
   every subscriber without their own settings. It starts as **Gemini Live**
   (`gemini-3.8-live`), which needs only the Gemini key.
3. **Per subscriber** (admins and super admins) — Admin → Subscribers → a subscriber →
   **AI**: switch them to another engine or model, or add a key of their own (for
   example an Enterprise customer paying their AI vendor directly). Their own key wins
   over the platform key for that vendor; "Use platform default" undoes it.

The panel shows, for every key the chosen engine needs, where it comes from
(subscriber's own, platform, server environment) or **Missing**. Until nothing is
missing, that subscriber's agents can't go live and their dashboard says the team is
finishing the AI voice setup.

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
- [ ] Super admin → AI providers: Gemini key saved; a test call on the default Gemini Live engine (and on OpenAI Realtime / Cascaded if you offer them)
- [ ] Google Calendar: connect, book from a test call, event appears with invite
- [ ] Captcha on, and each protected form submits
- [ ] Legal pages (privacy, terms) reviewed by counsel and published
- [ ] PageSpeed Insights on the live home page ≥ 90 (mobile)
- [ ] Admin → SEO & analytics: contact email and site name are yours (defaults are placeholders)
- [ ] Backups: run `deploy/backup.sh` once as the app user and test a restore

---

## 6. Backups and restore

Nightly at 03:15 (`/etc/cron.d/purple-voice-backup`, running `deploy/backup.sh`): a
`pg_dump` custom-format dump and a tarball of the uploads directory, kept 14 days in
`~/backups/purple-voice` (CloudPanel) or `/var/backups/purple-voice` (bare Ubuntu).
**Copy them off the server** too (e.g. `rclone` to R2/S3/B2 in the same cron).

Restore (as the app user; `<backups>` is the directory above):
```bash
pm2 stop all
set -a; . ~/.purple-voice/api.env; set +a     # bare Ubuntu: /etc/purple-voice/api.env
pg_restore --clean --if-exists --no-owner -d "${DATABASE_URL%%\?*}" <backups>/db_<stamp>.dump
tar -xzf <backups>/uploads_<stamp>.tar.gz -C "$(dirname "$STORAGE_LOCAL_PATH")"
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
