# Purple Voice

**AI voice agents for sales calls.** Purple Voice is a platform for creating, managing
and running AI-powered voice agents that call leads, qualify them, answer questions,
book appointments and hand hot prospects to a human — on the customer's own phone
numbers (Twilio, Plivo, SuperPhone), with an AI layer the Purple Voice team chooses
and manages per customer (OpenAI Realtime, Gemini Live, or Claude/OpenAI/Gemini with
Deepgram speech).

| | |
|---|---|
| **Website** | Home, pricing, FAQ, blog, contact/Enterprise, CMS pages — static, SEO-ready, Lighthouse 96–99 |
| **Subscriber dashboard** | Agents, campaigns, calls with transcripts and AI summaries, appointments, phone numbers, integrations, insights, developers (webhooks, API, automations), support with an AI assistant, billing |
| **Admin panel** | Subscribers and subscriptions, each subscriber's AI (engine, model, keys), "open their dashboard" to help set up, leads (CRM), support queue, pages, blog, FAQs, media library, SEO and analytics |
| **Super admin** | Revenue insights (MRR, ARR, churn, LTV, MRR movement), plans and pricing, AI providers (platform keys, default AI), staff, security (captcha), audit log |
| **Voice runtime** | Signed carrier webhooks, a WebSocket media bridge, OpenAI Realtime, Gemini Live and a cascaded Deepgram + Claude/OpenAI/Gemini engine with barge-in, booking, transfer and hang-up tools, and a campaign dialer |

### Plans
| Basic — $19/mo | Pro — $299/mo | Enterprise |
|---|---|---|
| 1 AI agent · 1 number · 1 campaign · 100 contacts per campaign · prompts, booking, summaries, transfer, Google Calendar and app integrations · **1,000 minutes** | Unlimited agents, numbers, campaigns and contacts · multiple integrations · webhooks and API · detailed insights · AI support assistant · priority support · advanced automations · **20,000 minutes** | Custom-built and maintained by the team |

Phone-number rental and AI usage are billed by those providers, not by Purple Voice.

---

## Stack

Next.js 15 · React 19 · Tailwind (CSS-variable design tokens) · Express 5 · Node 20 ·
PostgreSQL 16 · Prisma · Zod · TypeScript throughout. Built to run on a single
**KVM 2 VPS (4 GB RAM, 2 vCPU)** behind nginx with PM2.

```
packages/shared   plans, roles, enums and validation shared by API and web
apps/api          REST API, carrier webhooks, live-call WebSockets, background worker
apps/web          website, subscriber dashboard, admin panel
deploy/           CloudPanel setup, nginx, PM2, Postgres tuning, deploy, auto-deploy and backup scripts
```

## Quick start (local)

Requires Node.js 22+, Git and Docker Desktop (or your own Postgres 16).

```bash
git clone https://github.com/Fahad-Makhdoomi/purple-voice.git && cd purple-voice
npm run setup   # Postgres + Mailpit in Docker, env files with fresh secrets, deps, migrations, demo data
npm run dev     # http://localhost:3000 (web) + :4000 (api) + worker
```

Sign in with the super admin login `npm run setup` prints, or the demo subscriber
`demo@purplevoice.local` / `demo-password-1` (a Pro workspace with sample calls).
Choosing a plan activates it instantly in development.

Pushing to `main` deploys to production automatically once CI passes
([DEPLOYMENT.md § Day-to-day](DEPLOYMENT.md#day-to-day-from-your-machine-to-the-live-site)).

## Scripts

| Command | |
|---|---|
| `npm run dev` | Web, API and worker with reload |
| `npm run build` | Production build of all packages |
| `npm run typecheck` | Type-check shared, API and web |
| `npm test` | API unit tests (Vitest) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Database |
| `npm run images -w @pv/web` / `images:check` | Convert static images to WebP / verify (no duplicates, foldered) |

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — technical blueprint: roles, plans, data model,
  auth, API, voice runtime, dialer, billing, CMS, SEO, analytics, AI, security,
  performance, testing, known limitations.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — VPS setup, connecting payment gateways, carriers, AI
  providers, Google Calendar, SMTP, captcha and analytics; updates, backups, capacity,
  troubleshooting.
- **[BRAND.md](BRAND.md)** — brand, design tokens, components, imagery, data-viz and
  accessibility rules.
- **[.env.example](.env.example)** — every configuration variable, explained.
