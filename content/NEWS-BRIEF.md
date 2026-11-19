NEWS ARTICLE BRIEF — Purple Voice /news section (voice.purplerocket.co/news)

Goal: timely AI voice news stories that rank for news searches and lead sales/support
teams to Purple Voice. Read ../BRIEF.md "Product facts" and "Voice" first; those rules apply.

FILE
- One file per story: content/news/<slug>.md. slug = filename (lowercase, hyphens).
- JSON frontmatter between two `---` lines, then Markdown body. JSON must be valid.
- Fields: slug, title, seoTitle (<= 60 chars), seoDescription (140-160 chars, contains the
  focus keyword), excerpt (< 200 chars), focusKeyword, secondaryKeywords (2-4),
  category, tags (3-5, kebab-case, always include "ai-voice-news"), schemaType "NewsArticle",
  faq (3-5 entries {question, answer}), howToSteps [], publishedAt (YYYY-MM-DD).
- category must be exactly one of: News, Funding, Launches, Deals, Regulation.
- publishedAt: the day the news broke (or the day after). Never later than 2026-11-13.
- No "cover" field.

BODY (600-900 words)
- Do NOT repeat the title as an H1. Open with a 2-3 sentence news lede: who, what, when,
  with the focus keyword in the first 100 words.
- Suggested H2s: what was announced / the details; why it matters for teams that sell or
  support by phone; what to watch next. Short paragraphs, a bullet list or small table
  where it fits.
- Near the end, one short paragraph tying it back to Purple Voice honestly (e.g. what
  the news means if you're running AI calling today, link https://voice.purplerocket.co
  or /pricing; Free plan, no card). Never claim Purple Voice uses or partners with the
  company in the story unless BRIEF.md product facts say so (it does run on OpenAI
  Realtime, Gemini Live, Deepgram, Claude, Twilio, Plivo).
- 2-3 internal links to existing articles, relative URLs, chosen only from this list:
  /blog/ai-appointment-setting, /blog/ai-call-summaries-and-crm-notes, /blog/ai-calling-metrics-that-matter,
  /blog/ai-cold-calling-guide, /blog/ai-lead-qualification-calls, /blog/ai-outbound-calling-software,
  /blog/ai-voice-agent-latency-and-natural-conversation, /blog/ai-voice-agent-mistakes-to-avoid,
  /blog/ai-voice-agent-pricing-explained, /blog/ai-voice-agent-vs-human-sdr, /blog/ai-voice-agent-vs-ivr,
  /blog/ai-voice-agent-webhooks-and-api, /blog/best-ai-calling-software-2026, /blog/build-vs-buy-ai-voice-agent,
  /blog/connect-twilio-to-ai-voice-agent, /blog/disclose-ai-on-calls, /blog/do-not-call-lists-and-dialer-hygiene,
  /blog/how-ai-voice-agents-work, /blog/how-to-create-an-ai-voice-agent, /blog/is-ai-cold-calling-legal,
  /blog/realtime-vs-cascaded-voice-ai, /blog/speed-to-lead-ai-calling, /blog/tcpa-and-ai-voice-calls,
  /blog/test-your-ai-voice-agent, /blog/uk-pecr-ofcom-ai-calls, /blog/warm-transfer-ai-to-human,
  /blog/what-is-an-ai-voice-agent, /resources/ai-voice-agent-launch-checklist,
  /resources/sales-call-compliance-checklist, /resources/voice-ai-glossary, /resources/call-quality-scorecard
- End with "## Sources" listing 2-4 primary/credible source links as a Markdown bullet list.
- No "## FAQ" section (FAQ lives in frontmatter).

ACCURACY (most important)
- Verify every fact with WebSearch (and fetch pages where you can) before writing.
  State only what sources support. Attribute: "according to Forbes", "the company said".
- Mark self-reported numbers as such. If sources conflict, say so or leave it out.
- No invented quotes, numbers, customers or dates. If a claim can't be confirmed, drop it.
- Paraphrase; never copy sentences from sources. At most one direct quote under 15 words.
- Compliance stories: general information, not legal advice (say once, briefly).
- Style: plain, specific, sentence-case headings, no hype words, no exclamation marks.
