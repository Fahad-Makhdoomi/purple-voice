---
{
  "slug": "amazon-nova-2-5-sonic-generally-available",
  "title": "Amazon Nova 2.5 Sonic is generally available on Bedrock",
  "seoTitle": "Amazon Nova 2.5 Sonic now generally available",
  "seoDescription": "Amazon Nova 2.5 Sonic is generally available on Bedrock with better reasoning, tool calling and async tools. Regions, limits and what it means for voice agents.",
  "excerpt": "AWS released Nova 2.5 Sonic, a speech-to-speech model with stronger reasoning, more accurate tool calling and asynchronous tools, in four Bedrock regions.",
  "focusKeyword": "amazon nova 2.5 sonic",
  "secondaryKeywords": ["nova sonic bedrock", "speech-to-speech model", "aws voice agents"],
  "category": "Launches",
  "tags": ["ai-voice-news", "amazon", "speech-to-speech", "voice-models"],
  "schemaType": "NewsArticle",
  "faq": [
    {"question": "What is Amazon Nova 2.5 Sonic?", "answer": "It is Amazon's speech-to-speech foundation model for real-time voice conversations, available on Amazon Bedrock. AWS says it improves reasoning, instruction following and tool-calling accuracy over Nova 2 Sonic, with lower latency."},
    {"question": "When did Nova 2.5 Sonic launch?", "answer": "The Bedrock model card lists a launch date of October 5, 2026, with end of life no sooner than October 5, 2027."},
    {"question": "Which AWS regions support Nova 2.5 Sonic?", "answer": "The model card lists US East (N. Virginia), US West (Oregon), Europe (Stockholm) and Asia Pacific (Tokyo), with in-region inference only."},
    {"question": "What is asynchronous tool calling in Nova 2.5 Sonic?", "answer": "It lets the model keep talking while a tool, such as an order lookup, runs in the background. That avoids dead air on a call while the system waits for data."},
    {"question": "How much does Nova 2.5 Sonic cost?", "answer": "AWS says it is priced the same as Nova 2 Sonic. Check the Amazon Bedrock pricing page for current rates in your region."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-05"
}
---
Amazon Nova 2.5 Sonic, AWS's latest speech-to-speech model, became generally available on Amazon Bedrock on October 5, 2026. AWS says it improves reasoning, instruction following and tool-calling accuracy over Nova 2 Sonic, adds asynchronous tool calling and gives shorter, faster replies, aimed at voice agents that have to do things during a call.

It is priced the same as Nova 2 Sonic, according to AWS's announcement.

## What AWS released

Nova 2.5 Sonic is a single model that listens and speaks, rather than a chain of separate transcription, language and voice models. According to the Bedrock model card, it adds:

- **Stronger reasoning** for multi-step tasks in a live conversation.
- **Better instruction following**, meaning closer adherence to system prompts, personas and multi-step directions.
- **More accurate tool calling**, with AWS's example being looking up an order, checking eligibility and acting on it within one session.
- **Asynchronous tool calling**, so the conversation keeps going while a tool runs in the background.
- **Mixed text and voice** in the same session, streaming transcripts, configurable turn detection and switching between languages mid-conversation.

AWS's announcement says the model supports seven languages and a 256K-token context window.

| Detail | Per AWS |
| --- | --- |
| Model ID | `amazon.nova-2-5-sonic` |
| Launch date | Oct 5, 2026 |
| Regions | us-east-1, us-west-2, eu-north-1 (Stockholm), ap-northeast-1 (Tokyo) |
| Inference | In-region only (no cross-region profiles) |
| API | `InvokeModelWithBidirectionalStream` |
| Context / max output | 256K / 64K tokens |
| Default quota | 20 concurrent streaming sessions per account per region |
| Price | Same as Nova 2 Sonic |

AWS also says the model works with Strands Bidi Agents, its framework for building bidirectional voice agents.

### Context: Nova 2 Sonic's year

Nova 2 Sonic reached general availability in December 2025. AWS's release notes show two refreshes in 2026. The March update cut median latency by 150 ms and improved turn-taking on 8 kHz telephony audio. The May update reduced errors when speaking codes, amounts, addresses and phone numbers, AWS said, citing internal tests. Nova 2.5 Sonic is the first version-number step since.

## Why it matters for teams that sell or support by phone

Two items in this release map directly onto problems teams hit on real calls.

**Asynchronous tool calling targets dead air.** When a voice agent checks a calendar or CRM mid-call, a synchronous design can leave the caller in silence until the lookup returns. A model that keeps talking while the tool runs ("let me check that for you, while I do, can I confirm your postcode?") sounds more natural. Our piece on [voice agent latency](/blog/ai-voice-agent-latency-and-natural-conversation) explains why a second or two of silence does so much damage on the phone.

**Stricter instruction following cuts both ways.** AWS says the model follows instructions more closely and answers more concisely. That is useful for keeping a sales agent on script. It also means prompts tuned for Nova 2 Sonic may behave differently, so retest before switching. A [structured test plan](/blog/test-your-ai-voice-agent) helps here.

The 20-session default quota is worth noting for outbound teams. Twenty concurrent conversations per account per region is enough for a pilot, not for a large dialling campaign, so plan a quota increase early.

## What to watch next

- Independent latency and accuracy measurements. AWS's announcement does not include benchmark figures.
- More regions, and whether cross-region inference arrives as it has for other Bedrock models.
- Amazon Connect support. Nova 2 Sonic is offered through Connect in several regions; AWS has not said the same for 2.5 in the sources we reviewed.
- How it compares with other speech-to-speech options on [realtime vs cascaded](/blog/realtime-vs-cascaded-voice-ai) tradeoffs like voice control and cost.

## What this means if you run AI calling

Purple Voice doesn't run on Nova Sonic today. Our managed AI layer uses OpenAI Realtime, Gemini Live, or cascaded Deepgram speech with Claude, OpenAI or Gemini. The direction of this release, though, is the same one we watch across every provider: models that can use tools mid-call without stalling. If you want to see how a voice agent handles booking and lookups on a live call, you can build one and test it on your own phone on the [Free plan](/pricing), no card needed.

## Sources

- [AWS: Nova 2.5 Sonic model card (Amazon Bedrock)](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-5-sonic.html)
- [AWS News: Announcing Amazon Nova 2.5 Sonic with improved reasoning for voice agents](https://aws-news.com/article/2026-10-05-announcing-amazon-nova-25-sonic-with-improved-reasoning-for-voice-agents)
- [AWS: Release notes for Amazon Nova 2](https://docs.aws.amazon.com/nova/latest/nova2-userguide/release-notes.html)
