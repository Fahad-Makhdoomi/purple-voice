# Purple Voice — Architecture

**Status:** living document. When you change how a system works, change the section
that describes it in the same commit. A stale map is worse than none.

Companion documents: [DEPLOYMENT.md](DEPLOYMENT.md) (servers, providers, updates) ·
[BRAND.md](BRAND.md) (design system) · [.env.example](.env.example) (configuration).

---

## 1. What this is

Purple Voice is a platform for creating, managing and running **AI voice agents that
handle sales conversations over the phone**. Customers connect their own carrier
numbers (Twilio, Plivo, SuperPhone) and their own AI keys (OpenAI, Claude, Gemini);
Purple Voice runs the calls on its VPS.

One product, five faces:

| Face | Who | Where |
|---|---|---|
| **Public website** | visitors | `apps/web/src/app/(site)` — home, pricing, FAQ, blog, contact, CMS pages |
| **Subscriber dashboard** | subscribers | `apps/web/src/app/dashboard` |
| **Admin panel (CMS + CRM)** | admins, super admins | `apps/web/src/app/admin` |
| **API** | all of the above, carriers, developers | `apps/api/src` (Express) |
| **Voice runtime** | live calls | `apps/api/src/voice` (WebSocket media bridge) + `apps/api/src/worker.ts` (dialer) |

---

## 2. Roles and permissions

| | Visitor | Subscriber | Admin | Super admin |
|---|:-:|:-:|:-:|:-:|
| Website, pricing, blog, contact | ✓ | ✓ | ✓ | ✓ |
| Sign up, own workspace & billing | ✓ (sign-up) | ✓ | | |
| Connect numbers, create agents, run campaigns | | ✓ *paid plan only, within plan limits* | ✓ *inside a customer's workspace* | ✓ |
| All subscriber workspaces, help set up ("Open their dashboard") | | | ✓ | ✓ |
| Manage subscriptions (plan, status, dates, overrides) | | | ✓ | ✓ |
| Website pages, blog, FAQs, media, SEO & analytics settings | | | ✓ | ✓ |
| Leads (CRM) and support queue | | | ✓ | ✓ |
| Revenue, MRR, churn & usage insights | | | | ✓ |
| Plans & pricing, staff, security (captcha), audit log | | | | ✓ |

Enforcement lives in the API, never the UI:

- `middleware/auth.ts` — `authenticate`, `requireStaff`, `requireSuperAdmin`. The user
  row is re-read on every request, so suspensions and role changes apply instantly.
- `middleware/workspace.ts` — every dashboard request resolves **one** workspace.
  Subscribers always get their own (any header is ignored). Staff name a workspace
  with `X-Workspace-Id`; that is how "Open their dashboard" works, and every write
  made that way is audited with the staff member as actor.
- `middleware/entitlements.ts` — `requireActiveSubscription` and `requireFeature(key)`.
  Reading history never needs a subscription; connecting numbers, creating agents
  and placing calls do.
- The Next.js middleware (`apps/web/src/middleware.ts`) only redirects for comfort; it
  is not a security boundary.

---

## 3. Plans and entitlements

Defaults live in `packages/shared/src/plans.ts` and are seeded into the `Plan` table;
super admins edit prices, minutes and limits from **Admin → Plans & pricing**
without a deploy. `null` means unlimited, `0` means the feature is off.

| | Basic $19/mo | Pro $299/mo | Enterprise |
|---|---|---|---|
| Call minutes / month | 1,000 | 20,000 | custom |
| AI agents | 1 | unlimited | unlimited |
| Phone numbers | 1 | unlimited | unlimited |
| Campaigns | 1 | unlimited | unlimited |
| Contacts per campaign | 100 | unlimited | unlimited |
| App integrations | 2 (Google Calendar + 1) | unlimited | unlimited |
| Concurrent calls | 2 | 10 | 50 |
| Prompts, booking, summaries, transfer, Google Calendar | ✓ | ✓ | ✓ |
| Webhooks, developer API, detailed insights, AI support assistant, priority support, advanced automations | | ✓ | ✓ |

Phone-number rental and AI usage are billed by those providers on the customer's own
accounts and are never part of a plan.

`services/entitlements.ts` merges the plan with per-workspace overrides
(`Subscription.customLimits`, `customMinutes`, `customPriceCents` — how Enterprise is
modelled) into an `Entitlements` object. `assertWithinLimit()` throws
`403 plan_limit`; a missing subscription throws `402 subscription_required`. The
dashboard receives the same object to grey out what the plan lacks.

**Concurrent calls** is not a marketing limit: it protects the shared 2-core VPS.

---

## 4. Stack and why

| Layer | Choice | Why |
|---|---|---|
| Web | Next.js 15 (App Router), React 19, TypeScript | Server-rendered, statically generated public pages (SEO, 90+ PageSpeed), one app for site + dashboard + admin |
| Styling | Tailwind 3 over CSS variables | Every colour, font, radius, shadow and spacing value is a token in `apps/web/src/styles/tokens.css`; change it once, it changes everywhere |
| API | Node 20, Express 5, TypeScript | As specified. Express 5 propagates async errors, so routes stay flat |
| Database | PostgreSQL 16 via Prisma 6 | As specified. Parameterised queries only |
| Validation | Zod schemas in `packages/shared` | One schema for the form, the API contract and the DB write |
| Realtime | `ws` WebSocket server inside the API process | Carrier audio streams; no extra service |
| Jobs | A separate worker process with `FOR UPDATE SKIP LOCKED` | No Redis needed on a 4 GB box |
| Images | sharp (WebP), local disk or any S3-compatible bucket | See §13 |
| Billing | Stripe over its REST API | Checkout, portal and signed webhooks; no SDK version churn |

**Why this fits a KVM 2 (4 GB RAM, 2 vCPU):** three Node processes (web ≈ 500 MB,
api ≈ 300 MB, worker ≈ 150 MB) plus Postgres tuned to 1 GB of shared buffers. Live
calls pass μ-law audio straight through — the server never transcodes audio — so a
call costs a WebSocket pair and a little JSON, not CPU. See DEPLOYMENT.md § Capacity.

---

## 5. Repository layout

```
packages/shared/         plans, roles, enums, zod schemas, model lists (@pv/shared)
apps/api/
  prisma/schema.prisma   the whole data model;  prisma/seed.ts
  src/
    config/env.ts        every env var, parsed once; bad config stops boot
    lib/                 prisma, logger, crypto (AES-GCM, hashing), password (scrypt),
                         jwt, signed URLs, SSRF guard, CSV, mailer, audit
    middleware/          auth, workspace, entitlements, origin (CSRF), rate limits, errors
    services/            entitlements, subscriptions, stripe, calls, media, storage,
                         settings, captcha, revalidate, google-calendar, ai/*
    modules/             HTTP routers: auth, public, billing, workspace/*, admin/*,
                         super, developer-api
    telephony/           carrier adapters (twilio, plivo, superphone) + webhook routes
    voice/               media server, transports, call session, prompt, tools,
                         engines/ (openai-realtime, cascaded, deepgram), llm/ (claude,
                         openai, gemini)
    events/              emitEvent → webhooks, Zapier, automations
    jobs/                dialer, webhook delivery, maintenance
    server.ts            HTTP + WebSocket process
    worker.ts            background process
  test/                  vitest unit tests
apps/web/
  src/app/(site)/        public website          src/app/(auth)/  sign-in / sign-up
  src/app/dashboard/     subscriber dashboard    src/app/admin/   admin + super admin
  src/components/        brand/, site/<page>/, dashboard/, admin/, charts/, forms/, ui/
  src/lib/               api client, session, workspace context, server-side readers
  src/styles/            tokens.css (design tokens), globals.css
  public/images/<page>/  static images, one folder per page (WebP only)
deploy/                  nginx, PM2, Postgres tuning, server setup, deploy, backup
```

---

## 6. Runtime topology

```
                         ┌──────────────── VPS (Ubuntu 24.04, 4 GB / 2 vCPU) ────────────────┐
 Browser ──HTTPS──▶ nginx ─┬─ /            ─▶ pv-web    Next.js :3000                        │
                           ├─ /api/*       ─▶ pv-api    Express :4000 ──┐                    │
 Twilio / Plivo ─webhooks─▶├─ /api/telephony/*                          ├──▶ PostgreSQL 16   │
 Twilio / Plivo ═audio WS═▶├─ /ws/<carrier>/<call>/<sig> ─▶ pv-api      │                    │
                           └─ /uploads/*   ─▶ disk (storage/uploads)    │                    │
                                              pv-worker (dialer, webhooks, maintenance) ─────┘
                         └────────────────────────────────────────────────────────────────────┘
 pv-api ⇄ OpenAI Realtime / Deepgram (WebSocket) · Claude / OpenAI / Gemini (HTTPS streaming)
 pv-api / pv-worker ──▶ Twilio / Plivo REST · Stripe · Google Calendar · SMTP · customer webhooks
```

---

## 7. Data model (apps/api/prisma/schema.prisma)

Tenancy: every customer-owned row carries `workspaceId`; every query filters on it.
A subscriber `User` belongs to one `Workspace`; staff belong to none.

| Area | Models |
|---|---|
| Identity | `User`, `Session` (rotating refresh tokens), `PasswordReset` |
| Billing | `Workspace`, `Plan`, `Subscription`, `SubscriptionEvent` (append-only history with MRR deltas), `Payment`, `UsagePeriod` |
| Setup | `AiCredential` (encrypted BYO keys), `TelephonyAccount` (encrypted carrier credentials), `PhoneNumber` |
| Calling | `Agent`, `Campaign`, `CampaignContact`, `Call` (transcript JSON, summary, outcome, sentiment), `Appointment` |
| Developer | `Integration`, `WebhookEndpoint`, `WebhookDelivery`, `ApiKey` (hashed), `Automation` |
| Support & CRM | `Ticket`, `TicketMessage`, `Lead` |
| Website | `Page`, `Post`, `Faq`, `SiteSetting` (seo, security, analytics), `MediaAsset` |
| Audit | `AuditLog` |

Secrets are stored only in `*Enc` columns (AES-256-GCM, `lib/crypto.ts`). API keys
and refresh tokens are stored as SHA-256 hashes.

---

## 8. Authentication

- Passwords: scrypt (N=2¹⁵) from Node's standard library — memory-hard, no native addon.
- Sessions: a 15-minute JWT access token in an HTTP-only `pv_at` cookie, and a 30-day
  refresh token in an HTTP-only `pv_rt` cookie scoped to `/api/auth`. Refresh rotates
  the token; presenting an already-rotated token revokes the whole family
  (stolen-token detection). Cookies are `SameSite=Lax` and `Secure` in production.
- `pv_role` (readable by JS) only drives Next.js redirects.
- Password reset: single-use, hashed, one-hour tokens; resetting signs out everywhere.
- Login timing is equalised for unknown emails; responses never reveal which emails exist.

---

## 9. API surface

| Prefix | Auth | Purpose |
|---|---|---|
| `/api/auth/*` | public / session | register, login, refresh, logout, me, profile, password |
| `/api/public/*` | public | plans, FAQs, posts, pages, settings, sitemap, contact form |
| `/api/billing/*` | session (+ Stripe signature for `/webhook`) | plan, checkout, portal, cancel |
| `/api/app/*` | session; staff via `X-Workspace-Id` | context, overview, credentials, telephony, agents, campaigns, calls, appointments, insights, integrations, developers, support |
| `/api/integrations/google/callback` | signed OAuth state | Google Calendar connection |
| `/api/admin/*` | staff | overview, staff list, leads, tickets, subscribers, cms (pages, posts, faqs, settings, media, AI SEO) |
| `/api/admin/super/*` | super admin | insights, plans, staff, security settings, audit |
| `/api/telephony/:carrier/*` | signed URL | inbound, voice (answered), status, transfer |
| `/api/v1/*` | `Bearer pv_live_…` (Pro) | agents, calls, place a call, campaigns, add contacts |
| `ws /ws/:carrier/:call/:sig` | signed path | live call audio |

Errors are always `{ error: { code, message, details? } }`. Codes the UI relies on:
`validation_error`, `subscription_required` (402), `plan_limit` (403), `unauthorized`.

---

## 10. Telephony and the real-time voice runtime

### Connecting a number
1. The subscriber saves carrier credentials (verified with one API call, then encrypted).
2. They pick a number; `configureInbound` points its voice webhook at
   `/api/telephony/<carrier>/inbound?numberId=…&sig=…` (Twilio: `VoiceUrl`; Plivo: one
   Application per number). Rental stays on their carrier bill.

### Call lifecycle
```
Outbound: dialer/test call ─▶ Call row (QUEUED) ─▶ carrier REST "place call"
          carrier ─POST /voice─▶ answer document: stream audio to wss://…/ws/<carrier>/<callId>/<sig>
Inbound:  carrier ─POST /inbound─▶ plan & concurrency check ─▶ Call row ─▶ same stream document
Media:    WebSocket ─▶ CallSession ─▶ voice engine ─▶ audio back to the carrier
Status:   carrier ─POST /status─▶ applyCallStatus ─▶ (terminal) finalizeCall after 5 s
Finalize: duration → billed minutes → UsagePeriod, AI summary/outcome/sentiment,
          contact + campaign progress, events (webhooks, Zapier, automations)
```
`finalizeCall` is claimed with a conditional update, so the status callback, the
stream closing and the maintenance sweep can all call it; it runs exactly once.

Every URL handed to a carrier carries an HMAC signature over its purpose and
subject (`lib/signed-url.ts`), so callbacks are authenticated without depending on
each carrier's signature scheme. Twilio drops query strings on stream URLs, so the
media URL carries its signature in the path.

### Voice engines (`voice/engines`)
- **Realtime** — OpenAI Realtime speech-to-speech. Carrier μ-law goes in and out
  untouched (`audio/pcmu`). Server VAD detects barge-in; we clear the carrier queue
  and truncate the assistant item to what was actually heard.
- **Cascaded** — Deepgram streaming STT → Claude, OpenAI or Gemini (streamed) →
  Deepgram TTS in μ-law. Replies are spoken sentence by sentence as they stream, so
  the agent starts talking after the first sentence. Two words over the agent's voice
  aborts the LLM turn and clears playback.

LLM adapters (`voice/llm`) each keep their vendor's native history. For Claude this
matters: responses are appended exactly as returned (thinking blocks included),
nothing earlier is edited, effort is `low` for latency, tool inputs stream eagerly
and are validated before use, and server-side fallback is on (`fallbacks: "default"`,
not for Haiku) so a policy decline is retried on Anthropic's recommended model
instead of leaving the caller in silence.

### Agent tools (`voice/tools.ts`, executed in `voice/session.ts`)
`check_availability` and `book_appointment` (Google Calendar free/busy + events, plus
clash checks against existing appointments), `transfer_call` (carrier transfer to the
agent's transfer number), `end_call`. Inputs are validated with zod whatever the
vendor sent. Hangups and transfers wait for the last sentence to finish playing.

### Prompt assembly (`voice/prompt.ts`)
Subscriber prompt first (persona and pitch), then goal, knowledge, the call context
(who, time in the business time zone, contact CSV columns as `{{variables}}`), then
platform rules for speaking on the phone: short spoken sentences, one question at a
time, honest AI disclosure when asked, honour do-not-call, no voicemail messages.

---

## 11. Campaign dialer (`jobs/dialer.ts`)

Every `DIALER_INTERVAL_MS` the worker, for each running campaign inside its call
window (days + hours in the campaign's time zone), fills free concurrency slots with
due contacts. Contacts are claimed with `UPDATE … WHERE id IN (SELECT … FOR UPDATE
SKIP LOCKED)`, so nobody is dialled twice. No-answers retry after
`retryDelayMinutes` up to `maxAttempts`. When minutes run out the campaign pauses.
Do-not-call outcomes are never retried. A campaign completes when nothing is pending.

---

## 12. Billing

- Self-serve: `/api/billing/checkout` creates a Stripe Checkout session (or switches
  the price in place for an existing subscription, prorated). The Stripe webhook
  (`checkout.session.completed`, `customer.subscription.*`, `invoice.paid`) is the
  source of truth; signatures are verified with a 5-minute tolerance.
- Manual / Enterprise: admins create or edit subscriptions directly (plan, status,
  period end, custom price, minutes and limits). Manual subscriptions lapse three days
  after their period end.
- Development: with no Stripe key and `BILLING_DEV_BYPASS=true`, choosing a plan
  activates it instantly. Ignored in production.
- **Every** change goes through `services/subscriptions.ts → applySubscriptionChange`,
  which writes a `SubscriptionEvent` with its MRR delta. Revenue analytics read that
  history instead of reconstructing it.

Usage: each finished call adds its billed minutes (rounded up per call, like carriers)
to the workspace's `UsagePeriod` for the current billing period. New calls are refused
once the period's minutes are used.

---

## 13. Website, CMS and content management

- Public pages are **statically generated** and cached under tags (`plans`, `faqs`,
  `posts`, `post:<slug>`, `pages`, `page:<slug>`, `settings`). After any CMS edit the API
  calls `POST /internal/revalidate` with a shared secret; changes are live within
  seconds while pages stay static. If the API is unreachable, readers fall back to
  built-in content, so builds never fail on it.
- Pages and blog posts are written in Markdown and rendered on the server with
  `react-markdown`, which **does not render raw HTML** — admin content can't become XSS.
- Editors include a live preview, an image picker wired to the media library, an SEO
  panel (length counters, search preview, noindex) and **Draft with AI** (Claude writes
  title/description/excerpt for review).

### Media pipeline (`services/media.ts`)
Every upload is decoded, then:
1. **De-duplicated** — the SHA-256 of the uploaded bytes is checked; a match returns the
   existing asset instead of storing a copy.
2. **Converted to WebP at its original width and height** (never resized). JPEGs use
   quality 90; images with transparency are lossless; other graphics try both and keep
   the smaller file. EXIF is stripped after orientation is applied.
3. De-duplicated again on the WebP output's hash.
4. Stored at `<folder>/<name>-<hash>.webp`, where the folder is the page or post that
   uses it (`pages/home`, `blog/<slug>`, `brand`). Folder and URL never change after
   upload, so content links never break. Content-hashed names allow year-long caching.

Static images that ship with the code follow the same rules in
`apps/web/public/images/<page>/` and are enforced by `npm run images:check` in CI.

---

## 14. SEO

Per-page `generateMetadata` (title template, description, canonical, Open Graph,
Twitter card, noindex), a generated social card (`opengraph-image.tsx`), `sitemap.xml`
from published pages and posts, `robots.txt` (dashboard, admin, API and internal
routes disallowed), JSON-LD (`SoftwareApplication` with offers, `FAQPage`,
`BlogPosting`), semantic headings, and site-wide defaults plus Search Console
verification in **Admin → SEO & analytics**. Dashboards and admin send
`X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.

---

## 15. Analytics

- **Product analytics** — super admin: MRR, ARR, ARPU, customer and revenue churn
  (30 days), LTV, sign-up→paid, at-risk subscriptions, revenue collected per month,
  MRR movement (new / expansion / contraction / churn), sign-ups per day, usage leaders.
  Pro subscribers get call insights: connect rate, answer rate by hour, booking rate,
  sentiment, per-agent and per-campaign conversion.
- **Website analytics** — optional Plausible (cookie-free) and/or GA4, configured in the
  admin and loaded with `lazyOnload` after the page is interactive.

Charts follow BRAND.md § Data visualisation: one series per chart, hover tooltips, and
a data table under every chart.

---

## 16. AI in the platform

| Use | Whose key | Model |
|---|---|---|
| Voice agents (Realtime) | subscriber's OpenAI key | `gpt-realtime` / `gpt-realtime-mini` |
| Voice agents (Cascaded) | subscriber's Claude / OpenAI / Gemini key + Deepgram | subscriber's choice (default `claude-opus-5-5`; Sonnet/Haiku listed as faster options) |
| Call summaries, outcome, sentiment | subscriber's key, same vendor as the agent | structured JSON output |
| Dashboard AI support assistant (Pro) | platform `ANTHROPIC_API_KEY` | `ASSISTANT_MODEL` (default `claude-opus-5-5`), streamed, product guide prompt-cached |
| CMS "Draft with AI" SEO | platform key | `ASSISTANT_MODEL` |

All Claude calls go through `services/ai/claude.ts`, which applies server-side refusal
fallback and the right effort setting, and every Claude response checks `stop_reason`
(including `refusal`) before its content is used.

---

## 17. Developer platform (Pro)

- **Webhooks** — events `call.started`, `call.completed`, `call.transferred`,
  `appointment.booked`, `campaign.completed`, `contact.updated`. Deliveries are queued,
  signed (`X-PurpleVoice-Signature: t=<unix>,v1=<hmac-sha256(secret, "t.body")>`),
  retried with exponential backoff (8 attempts, ~24 h) and listed per endpoint.
- **REST API** — `/api/v1`, `Authorization: Bearer pv_live_…`, keys hashed at rest,
  shown once, revocable, 120 requests/minute.
- **Automations** — trigger + conditions + actions (POST to URL, email, Slack, add to
  campaign, mark do-not-call), with run counts and last error.
- **Zapier** (every plan) — each event is forwarded to the connected catch hook.

---

## 18. Security

| Threat | Defence |
|---|---|
| SQL injection | Prisma parameterised queries everywhere; the few raw queries use tagged templates (`$queryRaw\`…${value}\``), which bind parameters. No string-built SQL. |
| XSS | React escapes all output; Markdown rendered without raw HTML; JSON-LD escapes `<`; CSP (`script-src 'self'` + named captcha/analytics vendors, `object-src 'none'`, `frame-ancestors 'none'`); the API sends `default-src 'none'`. |
| CSRF | HTTP-only `SameSite=Lax` cookies plus an Origin check on every state-changing request (`middleware/origin.ts`). |
| Brute force & abuse | Rate limits in the API (auth, public forms, developer API, AI assistant) and at nginx; switchable captcha (Turnstile, reCAPTCHA v3, hCaptcha) per form; contact-form honeypot. |
| Stolen sessions | Rotating refresh tokens with reuse detection; suspension and password change revoke sessions. |
| Secrets at rest | AES-256-GCM for AI keys, carrier tokens, OAuth tokens and webhook secrets; hashes for API keys and refresh tokens; secrets redacted from logs. |
| Forged carrier callbacks | HMAC-signed callback and media URLs. |
| SSRF via customer URLs | Webhook, automation, Slack and Zapier URLs must be public https; private, loopback and link-local addresses are refused at save and at send. |
| Tenant isolation | Every customer query is scoped by the resolved `workspaceId`; staff access is explicit and audited. |
| Uploads | Image-only, size-capped, decoded and re-encoded by sharp (no original bytes are served), stored under server-generated keys. |
| Transport & headers | HSTS, TLS 1.2+, `X-Content-Type-Options`, `X-Frame-Options`, strict referrer and permissions policies. |
| Accountability | `AuditLog` for auth, billing, staff actions inside workspaces, CMS and settings changes. |

---

## 19. Performance (target: PageSpeed 90+)

Measured with Lighthouse (mobile, simulated throttling) on a production build:
home **96**, pricing **99**, blog post **99**; SEO and best practices 100. How:

- Public pages are static (ISR) and React Server Components; the home page ships
  ~107 KB of JavaScript, mostly the framework.
- Manrope is self-hosted by `next/font` (no third-party font request, no layout shift).
- All hero art (orb, glass cards, starfield, gradients, bento illustrations) is CSS and
  inline SVG, so there is no image to wait for at first paint.
- Images go through `next/image` (AVIF/WebP, responsive sizes, lazy below the fold);
  uploads are WebP at full resolution with year-long immutable caching.
- Analytics and captcha scripts load only where needed and after interactivity.
- Animations are transform/opacity only and respect `prefers-reduced-motion`.

---

## 20. Testing

- `npm test` — Vitest unit tests (`apps/api/test`): plans and limits, billing minutes,
  encryption and tamper detection, password hashing, signed URLs and OAuth state, CSV
  import and E.164 normalisation, outgoing and Stripe webhook signatures, time-zone
  conversion across DST, campaign call windows, prompt variables, tool gating and
  validation, TwiML/Plivo XML, μ-law timing.
- `npm run typecheck` — shared, API and web.
- `npm run images:check` — static images are WebP, foldered and unique.
- CI (`.github/workflows/ci.yml`) runs all of the above plus a production web build.
- Verified manually during development against a real Postgres: sign-up → plan →
  agent, plan limits and Pro gates, admin "open their dashboard", media upload
  (WebP + de-dupe), contact form + honeypot, and a full simulated Twilio inbound call
  (signature rejection, answer document, media WebSocket, status callback, billing).

---

## 21. Known limitations and next steps

- **SuperPhone** — credentials and numbers can be saved, but SuperPhone's
  programmable-voice/streaming API isn't publicly documented, so calls aren't placed
  through it yet (`telephony/superphone.ts` documents exactly what to implement).
- **HubSpot / Calendly** — tokens are stored; data sync is not implemented yet.
  Slack (automations) and Zapier (all events) are live.
- **Call recording** — `Agent.recordCalls` exists in the model but no recording
  pipeline is wired up.
- **Live provider testing** — carrier, OpenAI Realtime and Deepgram integrations follow
  the providers' documented protocols but must be exercised with real accounts before
  launch (DEPLOYMENT.md § Go-live checklist).
- **Compliance** — calling windows, do-not-call handling and AI disclosure are built in;
  consent for uploaded numbers (e.g. TCPA in the US) is the customer's responsibility and
  is stated in the Terms starter text, which needs legal review.
- One user per workspace today; team members per workspace is a natural next step.
