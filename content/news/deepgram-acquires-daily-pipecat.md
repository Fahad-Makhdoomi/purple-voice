---
{
  "slug": "deepgram-acquires-daily-pipecat",
  "title": "Deepgram to acquire Daily, maker of the open-source Pipecat framework",
  "seoTitle": "Deepgram acquires Daily: what happens to Pipecat",
  "seoDescription": "Deepgram acquires Daily, maker of the open-source Pipecat voice agent framework. Pipecat stays BSD-licensed under a new foundation. Details and next steps.",
  "excerpt": "Deepgram is buying Daily, the company behind Pipecat. The framework stays open source under an independent Pipecat Foundation, and will anchor Deepgram's new voice agent platform.",
  "focusKeyword": "deepgram acquires daily",
  "secondaryKeywords": ["pipecat foundation", "deepgram pipecat", "deepgram voice agent platform"],
  "category": "Deals",
  "tags": ["ai-voice-news", "deepgram", "pipecat", "open-source", "acquisitions"],
  "schemaType": "NewsArticle",
  "faq": [
    {"question": "Did Deepgram buy Daily?", "answer": "Deepgram announced on October 29, 2026 that it is acquiring Daily, the company behind the open-source Pipecat voice agent framework. Neither company disclosed the price, and the announcement did not give a closing date."},
    {"question": "Will Pipecat stay open source?", "answer": "Yes, according to Deepgram. Pipecat stays free under its existing BSD license, and Deepgram says it is setting up an independent Pipecat Foundation with contributing organizations to keep the framework vendor-neutral."},
    {"question": "Who governs the Pipecat Foundation?", "answer": "Deepgram's announcement says the foundation is being set up with many contributing and user organizations. Daily co-founder Kwindla Hultman Kramer told reporters a steering committee will oversee it and will include companies that compete with Deepgram."},
    {"question": "What is the Deepgram Voice Agent Platform?", "answer": "It is a forthcoming Deepgram product that combines its speech models with Pipecat and Daily's real-time infrastructure. Deepgram previewed it at its Deepgram Speak event and said technical details and availability would follow."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-29"
}
---
Deepgram said on October 29, 2026 that it is acquiring Daily, the company behind Pipecat, one of the most widely used open-source frameworks for building voice agents. The news that Deepgram acquires Daily came at Deepgram Speak, the speech AI company's first conference in San Francisco. Neither side disclosed the price.

The headline for developers: Pipecat stays open source, and Deepgram says it will move under an independent foundation rather than become a Deepgram-only product.

## What was announced

According to Deepgram's announcement and reporting by The Next Web and TechCrunch:

- **The deal.** Deepgram is acquiring Daily. Terms were not disclosed, and the announcement does not say when the deal closes.
- **The team.** Daily's team joins Deepgram. Co-founder Kwindla Hultman Kramer becomes Deepgram's head of open source.
- **Pipecat's license.** The framework remains free under its existing BSD license.
- **Governance.** Deepgram says it is establishing an independent Pipecat Foundation with contributing and user organizations. Kramer told reporters that a steering committee will oversee the foundation and will include companies that compete with Deepgram.
- **Daily's products.** The Next Web reports Deepgram will continue to sell, support and develop Daily's existing products, including its hosted real-time infrastructure on 75 points of presence.

Kramer framed the open-source commitment as a condition of the deal, saying keeping Pipecat open was fundamental to the decision to join Deepgram.

## A new voice agent platform and an open standard

Deepgram also used the event to preview two related pieces:

| Item | What it is | Status |
|---|---|---|
| Deepgram Voice Agent Platform | Deepgram speech models combined with Pipecat and Daily's infrastructure, with a choice of models and developer control over the architecture | Previewed; details and availability to follow |
| Real-Time Context Standard (RCS) | An open protocol, co-developed with the Pipecat team, for passing audio context such as tone, speaker identity and background sound between models | Introduced; open for feedback |
| New models and Global API | Two new live-conversation models, more languages, and an API aimed at connection reliability and lower latency | Announced |

The RCS idea addresses a familiar weakness of cascaded voice agents: when speech is turned into text for the language model, cues like hesitation, whispering or an unclear word are lost. RCS defines metadata to carry those signals, plus instructions for how the model should use them and how the reply should sound.

## Why it matters for teams that sell or support by phone

Pipecat sits underneath many voice agent products and in-house builds, so its future matters even to teams that have never heard of it.

- **Stability for builders.** A foundation with outside members on the steering committee reduces the risk that a key open-source layer gets locked to one vendor.
- **Full-stack competition.** Speech vendors are now selling complete agent platforms. Deepgram joins others moving from APIs to end-to-end products, which gives buyers more choice and more overlap to sort through.
- **Better cascaded calls.** If RCS is adopted, cascaded agents could respond to how something was said, not just the words, which narrows one gap with speech-to-speech models. For background, see [realtime vs cascaded voice AI](/blog/realtime-vs-cascaded-voice-ai).

## What to watch next

- The deal's closing date and the foundation's founding members.
- Pricing and launch date for the Deepgram Voice Agent Platform.
- Whether other model providers adopt the Real-Time Context Standard.
- How Daily's existing customers are handled during the transition.

## What this means if you run AI calling today

Purple Voice uses Deepgram speech recognition in its cascaded setups, alongside OpenAI Realtime and Gemini Live, with the AI layer chosen and managed per customer, so improvements in Deepgram's models are directly relevant to how calls sound and how fast agents reply. If you are deciding whether to build on frameworks like Pipecat or use a ready product, our [build vs buy guide](/blog/build-vs-buy-ai-voice-agent) lays out the trade-offs. You can also try a working agent on the Free plan at [voice.purplerocket.co](https://voice.purplerocket.co), no card needed.

## Sources

- [Deepgram: Deepgram to acquire Daily, makers of Pipecat](https://deepgram.com/blog/daily-pipecat-deepgram)
- [The Next Web: Deepgram buys Pipecat maker Daily and keeps the voice AI framework open](https://thenextweb.com/news/deepgram-daily-acquisition-pipecat-open-source)
- [audioXpress: Deepgram acquires Daily to build open conversational voice AI platform around Pipecat](https://audioxpress.com/news/deepgram-acquires-daily-to-build-open-conversational-voice-ai-platform-around-pipecat)
