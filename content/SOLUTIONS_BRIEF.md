# Brief — Purple Voice solution pages (landing page + blog hybrid)

Read `content/BRIEF.md` first: its PRODUCT FACTS, voice rules and "never invent" rules apply in full
(no fake stats/customers/quotes, no email/WhatsApp claims, no hype words, no exclamation marks,
sentence case, general-info legal disclaimers once). Then read `content/SOLUTIONS.md` for your
pillar's slugs, keywords and angles. Write ONE file per slug to `content/solutions/<slug>.md`
(create the folder if missing). Touch no other files.

Goal: rank for the focus keyword AND convert. Each page reads like a landing page (clear promise,
scannable benefit blocks, how-it-works, concrete example, CTA) with the depth of a good blog post.

## Frontmatter (JSON between `---` lines, then body)
```
{
  "slug": "ai-voice-agent-for-insurance",
  "title": "AI voice agent for insurance: quotes, renewals and claims calls",
  "seoTitle": "AI voice agent for insurance | quotes, renewals, FNOL (≤ 65 chars)",
  "seoDescription": "140-158 chars, focus keyword early, concrete benefit, no hype.",
  "excerpt": "1-2 sentences (≤ 190 chars) shown as the page subhead and on cards.",
  "focusKeyword": "ai voice agent for insurance",
  "secondaryKeywords": ["3-5 close variants"],
  "category": "<the pillar category name from SOLUTIONS.md, exactly>",
  "tags": ["2-4 lowercase tags, include the pillar slug e.g. insurance"],
  "cover": "/images/solutions/covers/<slug>.webp",
  "schemaType": "BlogPosting",
  "faq": [{"question": "…?", "answer": "2-3 sentences."}],
  "howToSteps": [{"name": "3-4 word step", "text": "1-2 sentences"}],
  "publishedAt": "2026-10-20"
}
```
- JSON valid, `slug` = filename. seoTitle ≤ 65 chars. title ≤ 90 chars. Every title distinct.
- `howToSteps`: exactly 4 steps = the "How it works" cards the page renders above the body
  (e.g. Upload your list → Agent calls → Qualifies and books → You review summaries). Tailor to the niche.
- 4-5 FAQ entries phrased as real search queries (People Also Ask style), specific to the page.
- `publishedAt`: hubs 2026-10-16..2026-10-20; spokes spread 2026-10-21..2026-11-08; each file different;
  never later than 2026-11-08.

## Body (Markdown, 900-1,400 words, no H1, no "## FAQ" section, no "How it works" H2 — those render from frontmatter)
1. Opening: 2-3 sentences that directly answer/define, focus keyword in first 100 words, who it is for.
2. `## What an AI voice agent does for <niche>` — a bullet list of 5-7 concrete jobs (bold lead-in each).
3. A table (e.g. "Before / With an AI voice agent", or "Call type → what the agent does → when it hands off").
4. `## A sample call` — a short realistic exchange (Agent:/Caller: lines, 6-10 lines) specific to the niche,
   labelled illustrative. Never put real brand names in it.
5. `## What to set up first` — numbered checklist tied to real product features (agent prompt, knowledge base,
   campaign hours & retries up to 5, Google Calendar booking, warm transfer, summaries/transcripts, consent
   confirmation, test-call on your own phone).
6. `## Where it falls short` — honest limits and what stays with a human (builds trust; vary per page).
7. At least 2 H2s containing the focus keyword or a close variant (e.g. the first and a later one).
8. Closing `## Try it` paragraph: specific and honest — "Free plan, no card, 100 minutes a month" —
   with link to https://voice.purplerocket.co and `/pricing`.
- Internal links: 4-6 relative links (`/solutions/<slug>` to siblings and the pillar hub — a spoke MUST link its hub and
  2-3 siblings; a hub must link at least 6 spokes — plus 1-2 from the existing slugs listed in SOLUTIONS.md).
  Only link slugs that exist in SOLUTIONS.md or that list. Use descriptive anchor text, not "click here".
- Do not embed images (the cover is rendered by the page). No screenshots needed.
- Make every page genuinely different: different examples, numbers (illustrative, labelled), objections,
  call script, checklist items and limits. No template-feeling repetition; vary section order of items 3/4/6
  and headline wording. No filler openers. Don't repeat the same sentence across pages.
- After writing, self-check: valid JSON (parse it mentally or with node), slug==filename, counts of steps/FAQ.
  Report back only: the count written and any slug you could not finish. Keep the report to 3 lines.
