# Content brief — Purple Voice blog and resources

Goal: organic search traffic to https://voice.purplerocket.co. Every article targets one
primary keyword a real buyer would search, answers it better than the current top results,
and leads naturally (never pushily) to trying Purple Voice.

## Product facts (do not invent beyond these)

Purple Voice: AI voice agents for sales calls. An agent calls leads (outbound campaigns) and
answers calls (inbound), qualifies, answers questions from a knowledge base, handles
interruptions, books appointments on Google Calendar, transfers hot calls to a human, sends
call summaries and transcripts. Runs on the customer's own phone numbers (Twilio, Plivo,
SuperPhone). AI layer is managed by the Purple Voice team per customer (OpenAI Realtime,
Gemini Live, or cascaded Deepgram speech + Claude/OpenAI/Gemini).
Dashboard: Overview, Agents (prompt, voice, knowledge, test-call on your own phone), Campaigns
(upload a list, calling hours, retries up to 5 with retry hours, progress bar, not-reached
analytics, consent confirmation), Calls (transcripts, AI summaries, recordings), Appointments,
Phone numbers, Integrations (Google Calendar, email, WhatsApp coming soon), Insights, Developers
(webhooks, API keys, automations), Support (AI assistant), Billing.
Plans: Free $0 (1 agent, 1 number, 1 campaign, 100 contacts/campaign, 100 minutes/mo, booking +
summaries, 1 integration, no card) · Basic $19/mo (1 agent, 1 number, 1 campaign, 100 contacts,
1,000 minutes) · Pro $299/mo (unlimited agents/numbers/campaigns/contacts, webhooks, API,
insights, priority support, advanced automations, 20,000 minutes) · Enterprise custom.
Phone-number rental and AI usage are billed by those providers, not Purple Voice.
Voice: plain, specific, confident not loud, sentence case, speaks to the sales lead/founder/agency
owner, honest about limits. No hype, no exclamation marks, no "unlock/revolutionise/game-changer".
CTAs go to https://voice.purplerocket.co (links in body: `/pricing`, `/blog/<slug>`, `/resources/<slug>`).
Never claim stats, customers, awards or testimonials that aren't given. Industry statistics must be
omitted unless widely known and hedged ("often", "many teams"); no fake numbers, no fake quotes.
Legal/compliance content (TCPA, GDPR, PECR, Ofcom, DNC) is general information, not legal advice —
say so once, briefly, and recommend checking current rules.

## Output format

One Markdown file per article in `content/blog/<slug>.md` or `content/resources/<slug>.md`.
File = a JSON frontmatter block between two `---` lines, then the body. Example:

```
---
{
  "slug": "ai-cold-calling-guide",
  "title": "AI cold calling: how it works and when to use it",
  "seoTitle": "AI cold calling: how it works and when it pays off (2026)",
  "seoDescription": "150-160 chars, includes the focus keyword, promises a benefit.",
  "excerpt": "1-2 sentence summary shown on cards (under 200 chars).",
  "focusKeyword": "ai cold calling",
  "secondaryKeywords": ["ai cold caller", "automated cold calls"],
  "category": "Guides",
  "tags": ["ai-calling", "outbound"],
  "cover": "/images/blog/covers/ai-cold-calling-guide.webp",
  "schemaType": "BlogPosting",
  "faq": [{"question": "…?", "answer": "2-3 sentence answer."}],
  "howToSteps": [],
  "publishedAt": "2026-09-14"
}
---
Body in Markdown…
```

Rules:
- JSON must be valid (double quotes, no trailing commas). `slug` equals the filename.
- Blog `category` is one of: Guides, Playbooks, Use cases, Compliance, Comparisons, Product.
  Resource `category` is one of: Templates, Checklists, Scripts, Glossary, Calculators, Frameworks.
- `schemaType`: BlogPosting (default), HowTo (step-by-step posts; then fill `howToSteps`
  as [{"name","text"}]), TechArticle for technical.
- `publishedAt`: spread dates between 2026-07-01 and 2026-10-15, one per file, each file different.
- 4-6 FAQ entries per article, real questions people ask (People Also Ask style), phrased as search queries.
- Body: 1,100–1,800 words for blog, 700–1,300 for resources. Do NOT repeat the title as an H1
  (the page renders it). Start with a 2-3 sentence direct answer/intro containing the focus keyword
  in the first 100 words. Use H2 sections (include the focus keyword or a variant in at least two
  H2s), H3 where useful, short paragraphs, bullet lists, at least one table or checklist where it
  fits. End with a short "Try it" paragraph linking to https://voice.purplerocket.co with
  specific, honest framing (Free plan available, no card). Do not add a "## FAQ" section — FAQs
  live in frontmatter and are rendered by the page.
- Internal links: 3-5 per article, to OTHER slugs from `content/TOPICS.md` using relative URLs
  (`/blog/slug`, `/resources/slug`). Only link slugs that exist in TOPICS.md.
- Real product screenshots (use where the post is about the product, 1–3 per such post, with
  descriptive alt text and a one-line caption in italics under each). Available files:
  `/images/blog/screens/` + `overview.webp` (dashboard home), `agents.webp` (agents list),
  `agent.webp` (agent editor), `agent-new.webp` (create agent), `calls.webp` (calls list),
  `call-detail.webp` (transcript + summary), `insights.webp` (analytics), `integrations.webp`,
  `billing.webp`, `support.webp`, `website-home.webp`, `website-pricing.webp`.
  Only describe what a screenshot plausibly shows from its filename/role; you may view the
  PNG-converted originals at `../videos/purple-voice-launch/capture/assets/` (same names, with `app-`
  prefix for dashboard and `site-` for website) to check before describing them.
- Unique, specific, useful. No filler intros ("In today's fast-paced world"), no AI cliches, no
  repeated structure across articles. Vary angle: examples, mini scripts, worked numbers (labelled
  as illustrative), checklists.
- Do not touch any file except your assigned slugs.
