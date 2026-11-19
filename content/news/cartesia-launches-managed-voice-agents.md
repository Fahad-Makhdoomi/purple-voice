---
{
  "slug": "cartesia-launches-managed-voice-agents",
  "title": "Cartesia launches Managed Agents, a hosted voice agent platform",
  "seoTitle": "Cartesia Managed Agents: hosted voice agents launch",
  "seoDescription": "Cartesia Managed Agents launched with telephony, outbound batch calling and $0.03/min launch pricing. What's included, the limits and what it means for teams.",
  "excerpt": "Voice model maker Cartesia launched Managed Agents, a hosted platform with telephony and outbound campaigns, at a launch price of $0.03 a minute.",
  "focusKeyword": "cartesia managed agents",
  "secondaryKeywords": ["cartesia voice agents", "hosted voice agent platform", "voice agent pricing"],
  "category": "Launches",
  "tags": ["ai-voice-news", "cartesia", "voice-agent-platforms", "outbound-calling"],
  "schemaType": "NewsArticle",
  "faq": [
    {"question": "What is Cartesia Managed Agents?", "answer": "It is Cartesia's hosted platform for building and running real-time voice agents. Cartesia handles listening, turn-taking, interruptions, tool calls and knowledge retrieval around a language model you choose, and includes telephony."},
    {"question": "How much does Cartesia Managed Agents cost?", "answer": "Cartesia announced launch pricing of $0.03 per minute, which it describes as 50% off. Check Cartesia's pricing page for what that rate includes and how long it lasts."},
    {"question": "Can Cartesia agents make outbound calls?", "answer": "Yes. Cartesia's docs describe an outbound call API and batch calling that queues up to 5,000 recipients. Calls from Cartesia numbers are placed at most one per second."},
    {"question": "Are Cartesia's benchmark rankings independent?", "answer": "The leaderboards it cites are run by third parties, Artificial Analysis and ServiceNow, but the rankings and the turn-taking figures were reported by Cartesia at launch."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-29"
}
---
Cartesia, best known for its Sonic text-to-speech models, launched Cartesia Managed Agents on October 29, 2026. It is a hosted platform for building and deploying voice agents, with telephony and outbound calling included. The company set launch pricing at $0.03 per minute, which it describes as 50% off.

The launch puts another speech-model company in direct competition with the voice agent platforms that have been its customers.

## What Cartesia announced

According to Cartesia's launch post and documentation, Managed Agents bundles the parts of a voice agent that teams usually stitch together themselves:

- **Conversation handling.** Cartesia manages listening, turn-taking, interruptions, tool calls and knowledge retrieval. You pick the language model and its settings.
- **Tools.** Built-in system tools (such as ending a call), webhook tools that call your server, and client tools that run in your app.
- **Knowledge bases** with context that can be filled in per call.
- **Versions and evaluations.** Configuration history with rollback, plus built-in and custom call-quality metrics.
- **Telephony and outbound campaigns.** Cartesia says outbound batches can schedule thousands of personalised calls.
- **Languages.** Cartesia says agents can be built in 44 languages, with mid-conversation switching between English, Spanish, Hindi, French and Japanese. Its wording suggests not all 44 are live yet.

### Outbound calling details

Cartesia's developer docs give the specifics for outbound:

| Item | Per Cartesia docs |
| --- | --- |
| Endpoint | `POST /agents/calls` |
| Number format | E.164 |
| Ringing timeout | 5–80 seconds, default 60 |
| Pace from a Cartesia number | Up to 1 call per second, extra requests queued |
| Batch calling | Queues up to 5,000 recipients |
| Per-call variables | Up to 64, for personalisation |

### Benchmarks, as reported by Cartesia

Cartesia says Managed Agents ranked first of 30 agents on Artificial Analysis's Speech Agent Arena and posted the top scores on ServiceNow's EVA-Bench at launch. It also cites internal tests in which callers reported no turn-taking problems in 85% of conversations, against 67% for other agents. These figures are self-reported, and Cartesia's benchmark runs used a specific reasoning model, so results with a different model may differ.

## Why it matters for teams that sell or support by phone

**Per-minute prices keep falling, but compare like for like.** $0.03 a minute is a launch rate, and Cartesia calls it half price. Before comparing it with other platforms, check what it includes. LLM usage and phone-number costs are often billed separately across this market. Our guide to [AI voice agent pricing](/blog/ai-voice-agent-pricing-explained) shows how to add up a true cost per call.

**Model makers are moving up the stack.** When the company that makes the voice model also hosts the agent, it can tune speech, turn-taking and timing together, which is Cartesia's pitch. The tradeoff is less freedom to swap the speech layer later.

**Outbound pacing matters for campaigns.** One call per second per number and a 5,000-recipient batch queue are workable for most campaigns. Number reputation, calling hours and consent rules are still yours to handle. See our [outbound calling software guide](/blog/ai-outbound-calling-software) for what to check beyond dial speed.

## What to watch next

- The standard price after launch pricing ends, and what a minute includes.
- Independent tests of the benchmark claims with other language models.
- How many of the 44 languages go live, and when.
- Whether existing platforms built on Cartesia's voices respond on price or switch providers.

## What this means if you run AI calling

Hosted voice agent platforms are getting cheaper per minute and more complete, which is good for buyers. The decision for most sales teams is less about the speech model and more about whether the platform handles campaigns, retries, booking, transfers and CRM notes the way you work. Purple Voice is built for sales calls, runs on your own phone numbers, and has a [Free plan](/pricing) with no card if you want to compare in practice. Our list of [the best AI calling software in 2026](/blog/best-ai-calling-software-2026) is another starting point.

## Sources

- [Cartesia: Introducing Managed Agents](https://www.cartesia.ai/blog/managed-agents)
- [Cartesia Docs: Managed Agents introduction](https://docs.cartesia.ai/agents/introduction)
- [Cartesia Docs: Outbound dialing](https://docs.cartesia.ai/line/integrations/telephony/outbound-dialing)
