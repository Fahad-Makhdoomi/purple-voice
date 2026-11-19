---
{
  "slug": "hume-ai-shuts-down-octave-evi-apis",
  "title": "Hume AI shuts down its Octave TTS and EVI voice APIs",
  "seoTitle": "Hume AI shuts down Octave TTS and EVI APIs: what to know",
  "seoDescription": "Hume AI shuts down its Octave TTS and EVI APIs on November 13, 2026 and deletes account data. What changed and what it means for voice API vendor risk.",
  "excerpt": "Access to Hume's text-to-speech and EVI voice APIs ended on November 13, 2026, as the company moves to its Audio Decisions API. A reminder to plan for vendor exits.",
  "focusKeyword": "hume ai shuts down",
  "secondaryKeywords": ["hume octave tts shutdown", "hume evi api", "voice api vendor risk"],
  "category": "News",
  "tags": ["ai-voice-news", "text-to-speech", "voice-api", "vendor-risk"],
  "schemaType": "NewsArticle",
  "faq": [
    {
      "question": "When did Hume's Octave TTS and EVI APIs shut down?",
      "answer": "Hume's developer documentation says access to the TTS and EVI APIs ends on November 13, 2026 at 12:01 a.m. EST. The notice was added to its changelog on October 2, 2026."
    },
    {
      "question": "What happens to data in a Hume account after the shutdown?",
      "answer": "Hume says any data in an account is permanently deleted after November 13, 2026. Anyone with voices, transcripts or other data there should contact Hume support directly."
    },
    {
      "question": "What is Hume's Audio Decisions API?",
      "answer": "It is a model that answers questions about audio rather than generating speech. You send audio with a question and possible answers, and it returns probabilities, for example whether a caller sounds frustrated. Hume announced it on November 2, 2026, with access through a waitlist."
    },
    {
      "question": "How do you reduce vendor risk when building on a voice API?",
      "answer": "Keep prompts, knowledge and call logic in your own systems, store your own transcripts and recordings, avoid features you cannot recreate elsewhere, and test a second provider before you need it."
    }
  ],
  "howToSteps": [],
  "publishedAt": "2026-11-13"
}
---
Hume AI shuts down its Octave text-to-speech and Empathic Voice Interface (EVI) APIs today. According to Hume's developer documentation, access to both ends on November 13, 2026 at 12:01 a.m. EST, and any data left in customer accounts is permanently deleted after that date. The company is now focused on analysing audio rather than generating it, led by its new Audio Decisions API.

## What changed

Hume posted the end-of-access notice in its voice changelog on October 2, 2026, giving developers about six weeks to move. The key points from the notice:

- The TTS (Octave) and EVI APIs stayed fully supported until the cutoff.
- Access ends November 13, 2026 at 12:01 a.m. EST.
- Account data is permanently deleted after November 13.
- Hume points developers to its Real World VoiceEQ tool for comparing alternative voice models, and to its support team for questions.

EVI was Hume's speech-to-speech interface for building voice agents, and Octave was its expressive text-to-speech model. Both were used by developers building conversational voice products.

On November 2, Hume introduced the Audio Decisions API, which it describes as an audio-native model that answers questions about speech and sound. Developers send audio along with a question and a set of possible answers (yes/no, multiple choice, a rating or a time span), and the model returns probabilities. Hume says it is built for fast, low-cost judgments across live calls, recording archives and voice model evaluation, and reports that in its own initial evaluation the model agreed with a human panel's average judgment more often than a single human rater did. That figure is self-reported. Access is through a waitlist.

## Why it matters for teams that sell or support by phone

Hume's new direction may be useful, but the shutdown is the more practical lesson. A voice agent depends on several providers at once: telephony, speech recognition, a language model and a voice. If one of them retires a product, the agent stops working or has to be rebuilt.

Some third-party migration guides note that custom or designed voices generally cannot be moved between providers, so a brand voice built on one platform may need to be recreated from the original recordings. Teams that only kept data inside a vendor's account face the deletion deadline on top of the migration.

A short portability checklist:

| Risk | What to do now |
|---|---|
| Prompts and call logic live only in a vendor console | Keep a copy of every prompt, script and knowledge source in your own system |
| Transcripts and recordings only in the vendor account | Export them regularly or send them to your CRM via webhooks |
| A single voice or model you cannot replace | Test the same agent on a second provider before you need to |
| No notice process | Assign someone to watch vendor changelogs and status pages |

The [build vs buy guide](/blog/build-vs-buy-ai-voice-agent) goes further on who carries this risk in each model, and [realtime vs cascaded voice AI](/blog/realtime-vs-cascaded-voice-ai) explains why the architecture you pick affects how easily you can swap parts.

## What to watch next

- Whether other voice API providers narrow or retire products, and how much notice they give.
- How Hume's Audio Decisions API performs outside the company's own evaluations once more developers have access.
- Pricing and feature changes among the remaining text-to-speech and speech-to-speech providers as former Hume customers move.

Purple Voice does not run on Hume. The AI layer for each customer is managed by our team on OpenAI Realtime, Gemini Live, or a cascaded setup with Deepgram speech and Claude, OpenAI or Gemini, rather than tied to a single voice API. Your agent's prompt and knowledge live in your dashboard, and transcripts and summaries can be sent to your own systems with webhooks on Pro. You can see how it works on the Free plan, no card needed, at [voice.purplerocket.co](https://voice.purplerocket.co).

## Sources

- [Hume developer docs: Voice changelog](https://dev.hume.ai/voice/changelog)
- [Hume: Introducing the Audio Decisions API](https://www.hume.ai/blog/introducing-hume-audio-decision-api)
- [Hume developer docs: Audio Decisions API overview](https://dev.hume.ai/voice/docs/voice/overview)
