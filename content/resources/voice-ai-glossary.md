---
{
  "slug": "voice-ai-glossary",
  "title": "Voice AI glossary: 40 terms for AI calling, defined plainly",
  "seoTitle": "Voice AI glossary: 40 key terms in AI calling explained",
  "seoDescription": "A voice AI glossary with 40 terms defined in plain English: STT, TTS, latency, barge-in, warm transfer, knowledge base, webhooks and more for AI calling.",
  "excerpt": "Forty terms you will meet when buying or running AI voice agents, from speech-to-text and latency to warm transfer and webhooks, defined without jargon.",
  "focusKeyword": "voice ai glossary",
  "secondaryKeywords": ["voice ai terms", "ai calling glossary", "conversational ai terminology"],
  "category": "Glossary",
  "tags": ["glossary", "definitions", "voice-ai"],
  "cover": "/images/resources/covers/voice-ai-glossary.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is a voice AI glossary?", "answer": "A list of the terms used in voice AI and AI calling, each explained in plain language. It helps buyers compare tools and helps teams talk about what an agent is doing."},
    {"question": "What does STT mean in voice AI?", "answer": "STT stands for speech-to-text. It converts what a caller says into written text so a language model can read it."},
    {"question": "What is barge-in?", "answer": "Barge-in is when a caller interrupts the agent while it is speaking. A good agent stops talking and responds to what the person said."},
    {"question": "What is the difference between a warm and a cold transfer?", "answer": "In a warm transfer the agent briefs the human before or as the call is handed over. In a cold transfer the call is passed on with no briefing."},
    {"question": "What is a knowledge base in an AI voice agent?", "answer": "It is the set of facts the agent is allowed to use, such as pricing, services and policies. It keeps answers consistent and reduces made-up replies."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-13"
}
---
This voice AI glossary defines forty terms you will see when you buy, set up or review an AI voice agent. Definitions are short and plain, grouped by topic so you can scan to the part you need. For the bigger picture behind many of these terms, read [how AI voice agents work](/blog/how-ai-voice-agents-work).

## Core concepts

1. **AI voice agent**: software that holds a phone conversation using speech recognition, a language model and synthetic speech. See [what is an AI voice agent](/blog/what-is-an-ai-voice-agent).
2. **Outbound call**: a call the agent places to a lead or customer.
3. **Inbound call**: a call the agent answers when someone rings your number.
4. **Campaign**: a batch of outbound calls to a list of contacts, with rules for hours and retries.
5. **Lead**: a person who has shown some interest or fits your target market.
6. **Qualification**: asking questions to decide whether a lead is a fit and what to do next.
7. **IVR**: interactive voice response, the "press 1 for sales" phone menu. Different from an AI agent, which converses in natural speech.

## Speech technology

8. **STT (speech-to-text)**: converts spoken words into text. Also called ASR, automatic speech recognition.
9. **TTS (text-to-speech)**: turns text into spoken audio. The quality of the voice depends on it.
10. **LLM (large language model)**: the model that decides what the agent says, based on the conversation and instructions.
11. **Realtime model**: a model that handles speech in and speech out directly, with no separate STT and TTS steps.
12. **Cascaded pipeline**: a chain of separate STT, LLM and TTS stages. Compare the approaches in [realtime vs cascaded voice AI](/blog/realtime-vs-cascaded-voice-ai).
13. **Voice**: the synthetic speaker chosen for the agent, including accent, pace and tone.
14. **Transcription**: the written record of a call, produced by STT.
15. **Diarization**: separating who said what in a transcript.

## Conversation behaviour

16. **Latency**: the delay between a person finishing speaking and the agent replying. Long delays feel unnatural.
17. **Barge-in**: a caller interrupting the agent. A good agent stops and responds.
18. **Turn-taking**: the way a conversation passes between speakers, including knowing when someone has finished.
19. **Endpointing**: detecting that the speaker has stopped talking.
20. **Filler**: short phrases like "let me check" that cover a pause while the agent works.
21. **Hallucination**: when a model states something false with confidence. Reduced by a knowledge base and clear rules.
22. **Guardrail**: a rule that limits what the agent may say or do.
23. **Persona**: the name, tone and role the agent adopts.

## Setting up an agent

24. **Prompt**: the written instructions that define the agent's goal, style and rules. Start with the [prompt template](/resources/ai-voice-agent-prompt-template).
25. **System prompt**: the standing instructions given to the model before the call begins.
26. **Knowledge base**: the facts the agent may draw on, such as pricing, services and policies. See the [knowledge base template](/resources/ai-voice-agent-knowledge-base-template).
27. **Variable**: a field from your contact list (such as first name) inserted into the prompt for each call.
28. **Test call**: a call from the agent to your own phone to check behaviour before launch.
29. **Opening line**: the first thing the agent says, usually written word for word.

## Telephony

30. **SIP**: Session Initiation Protocol, a standard way of setting up voice calls over the internet.
31. **Carrier / provider**: the company supplying phone numbers and call connectivity, such as Twilio or Plivo.
32. **Caller ID**: the number shown to the person receiving the call.
33. **Voicemail detection**: recognising an answering machine so the agent can leave a message or hang up.
34. **Retry**: another attempt to reach a contact who did not answer.

## Handing off and recording results

35. **Warm transfer**: passing a live call to a human with a briefing. See [warm transfer from AI to human](/blog/warm-transfer-ai-to-human).
36. **Cold transfer**: passing the call to a human without a briefing.
37. **Call summary**: a short written account of what happened and what was agreed.
38. **Booking**: the agent creating an appointment on a calendar, such as Google Calendar.
39. **Webhook**: an automatic message sent from one system to another when an event happens, such as a call ending. Used to update a CRM.
40. **API**: a way for software to talk to the platform directly, for example to start calls or fetch records.

## Related compliance terms worth knowing

These sit outside the numbered list because rules vary by country, and this is general information, not legal advice.

| Term | Plain meaning |
|---|---|
| Consent | Permission from the person to be called |
| Opt-out | A request to stop being contacted |
| Do-not-call list | A register of numbers you should not call |
| Disclosure | Telling the person they are speaking with an AI |
| Retention | How long you keep recordings and transcripts |

See the [sales call compliance checklist](/resources/sales-call-compliance-checklist) for practical items.

## How to use this glossary

- Share it with new team members who will read call summaries.
- When comparing tools, ask each vendor how they handle latency, barge-in, transfer and data retention.
- When tuning an agent, name the problem with the right term. "It has high latency on questions about pricing" is easier to fix than "it feels slow".

## Try it

The fastest way to learn these terms is to hear them in action. In Purple Voice you can build an agent, place a test call to your own phone and read the transcript and summary afterwards. The Free plan includes one agent and 100 minutes a month, with no card. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
