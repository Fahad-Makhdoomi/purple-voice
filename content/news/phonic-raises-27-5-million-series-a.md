---
{
  "slug": "phonic-raises-27-5-million-series-a",
  "title": "Phonic raises $27.5M Series A and launches Phonic-1 speech-to-speech model",
  "seoTitle": "Phonic raises $27.5M Series A, launches Phonic-1 model",
  "seoDescription": "Phonic raised a $27.5M Series A led by First Round and launched Phonic-1, a speech-to-speech model for voice agents. What it means for AI sales calls.",
  "excerpt": "Voice AI startup Phonic raised a $27.5M Series A led by First Round and released Phonic-1, a speech-to-speech model built for voice agents that use tools mid-call.",
  "focusKeyword": "phonic-1",
  "secondaryKeywords": ["phonic speech-to-speech", "phonic series a", "speech-to-speech voice agents"],
  "category": "Funding",
  "tags": ["ai-voice-news", "funding", "speech-to-speech", "voice-models"],
  "schemaType": "NewsArticle",
  "faq": [
    {
      "question": "How much did Phonic raise?",
      "answer": "Phonic announced a $27.5 million Series A on October 29, 2026, led by First Round with Lux Capital, Felicis and Definition participating. Reported total funding, including an earlier $4 million seed, is about $31.5 million."
    },
    {
      "question": "What is Phonic-1?",
      "answer": "Phonic-1 is a speech-to-speech model for voice agents. It takes in audio and produces audio directly, and Phonic says it can call tools while the caller is still speaking."
    },
    {
      "question": "What is the difference between speech-to-speech and cascaded voice AI?",
      "answer": "A cascaded system turns speech into text, runs a language model on the text, then turns the reply back into speech. A speech-to-speech model handles audio end to end, which can keep cues like tone and pauses and may cut delay."
    },
    {
      "question": "How much does Phonic cost?",
      "answer": "Phonic's website lists per-minute pricing, starting at $0.07 per minute on its Starter plan, with custom Enterprise pricing. Check the site for current rates."
    }
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-29"
}
---
Phonic, a San Francisco voice AI startup, announced a $27.5 million Series A on October 29, 2026, alongside the release of Phonic-1, its speech-to-speech model for voice agents. First Round led the round, with Lux Capital, Felicis and Definition taking part, according to the company. Phonic-1 is built to run phone and web voice agents that can look things up and take actions while a caller is still talking.

## The details

Phonic was founded by Moin Nadeem and Nikhil Murthy, both MIT graduates. Nadeem previously worked at MosaicML, which Databricks acquired in 2023. The company raised a $4 million seed led by Lux Capital, announced in April 2025, which puts reported total funding at about $31.5 million. Some coverage also lists Essence VC in the Series A. Phonic did not disclose a valuation or say how it plans to spend the money.

What Phonic says about Phonic-1:

- **Speech-to-speech:** the model works on audio directly rather than converting to text and back.
- **Tool calls mid-sentence:** it can call tools while the caller is still speaking, so the agent does not stall to look something up.
- **Supervisor models:** larger frontier models act as supervisors for harder reasoning and tool use.
- **Response time:** around 600 milliseconds, per the company.
- **Languages:** more than 50, including English, Spanish, Mandarin, Japanese, Arabic and Hindi.
- **Connections:** phone numbers, webhooks, WebSocket and LiveKit.

Phonic names Ashby, Maven AGI, Rho and Assort Health among its customers, plus an unnamed Fortune 50 IT infrastructure company. Its website lists per-minute pricing that starts at $0.07 a minute.

## How the benchmarks stack up

Phonic-1 placed first on Artificial Analysis' Speech to Speech Index, with a score of 87.1 for its High setting against 86.9 for Grok Voice 3.0. That is a narrow lead, and the index is one view among several.

Independent coverage of other tests gives a more mixed picture. In one third-party call simulation reported in the launch coverage, Phonic-1 ranked first on repeat reliability, but its median response time was slower than Grok Voice 3.0 and its interruption handling scored below several rivals. Other benchmark wins cited by Phonic are company-reported.

## Why it matters for teams that sell or support by phone

Speech-to-speech models are one of two main ways to build a voice agent. The other, a cascaded pipeline, chains separate speech recognition, language and voice models. Each has trade-offs, which we cover in [realtime vs cascaded voice AI](/blog/realtime-vs-cascaded-voice-ai).

For a sales call, the trade-offs show up in specific places:

| What you need on the call | Where speech-to-speech can help | What to check |
|---|---|---|
| Fast replies | Fewer hand-offs between models | Real latency on your phone line, not lab numbers |
| Natural tone | Keeps pauses and emotion that text drops | How it sounds on your scripts |
| Booking and lookups | Tool calls during the conversation | Errors when a tool or calendar fails |
| Handling interruptions | Hears audio directly | Recovery when a lead cuts in mid-pitch |

More money flowing into speech-to-speech models means more choice and steady price pressure on the realtime option. It also means benchmark claims will keep multiplying, so testing on your own calls matters more than any leaderboard. Our [voice agent latency guide](/blog/ai-voice-agent-latency-and-natural-conversation) explains which delays callers actually notice.

## What to watch next

- **Live-traffic results.** Benchmarks run in controlled setups. Error rates and costs on real call volume have not been published.
- **Price moves.** Phonic's per-minute rate sits between some of the cheapest and most expensive realtime options. Expect competitors to respond.
- **Adoption by platforms.** Voice agent platforms that let customers swap models could add Phonic-1 as an option.

## What this means if you run AI calling today

You do not need to pick a model yourself to benefit from this race. Purple Voice runs on either realtime models (OpenAI Realtime or Gemini Live) or a cascaded setup with Deepgram speech and Claude, OpenAI or Gemini, and the Purple Voice team manages that layer per customer. Phonic-1 is not one of the options. You set the prompt, voice and knowledge, test-call the agent on your own phone, and start on the [Free plan](https://voice.purplerocket.co) with no card.

## Sources

- [Phonic: company website and Series A announcement](https://phonic.ai/)
- [Magica: Phonic raises $27.5M for Phonic-1](https://magica.com/news/phonic-raises-27-5m-for-phonic-1-agentic-speech-ai)
- [CX Network: Every CX start-up funding deal you need to know, November 6](https://www.cxnetwork.com/cx-experience/news/every-cx-start-up-funding-deal-you-need-to-know-november-6)
