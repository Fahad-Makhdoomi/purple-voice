---
{
  "slug": "realtime-vs-cascaded-voice-ai",
  "title": "Realtime vs cascaded voice AI: speech-to-speech or a pipeline?",
  "seoTitle": "Realtime vs cascaded voice AI: tradeoffs for phone agents",
  "seoDescription": "Realtime vs cascaded voice AI explained: how speech-to-speech models and STT-LLM-TTS pipelines differ on latency, control, cost and reliability for phone calls.",
  "excerpt": "Two ways to build a voice agent: one model that listens and speaks directly, or a pipeline of separate speech and language steps. Here is how they compare on real calls.",
  "focusKeyword": "realtime vs cascaded voice ai",
  "secondaryKeywords": ["speech to speech vs pipeline", "cascaded voice agent", "realtime voice model"],
  "category": "Guides",
  "tags": ["technology", "architecture", "latency"],
  "cover": "/images/blog/covers/realtime-vs-cascaded-voice-ai.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is the difference between realtime and cascaded voice AI?", "answer": "A realtime or speech-to-speech model takes audio in and produces audio out directly. A cascaded setup chains separate steps: speech-to-text, a language model, then text-to-speech."},
    {"question": "Which is faster, realtime or cascaded voice AI?", "answer": "Realtime models often respond faster and sound more fluid because there are fewer hand-offs. A well-tuned cascaded pipeline with streaming can also feel quick, but it has more steps that can add delay."},
    {"question": "Which gives more control over what the agent says?", "answer": "Cascaded pipelines. Because the text is visible between steps, you can log it, filter it, swap components and fine-tune each part separately."},
    {"question": "Is realtime voice AI more expensive?", "answer": "It can be, depending on the provider and usage pattern. Pricing models differ, so compare on cost per minute of real conversations, not on list prices for individual components."},
    {"question": "Which is better for phone sales calls?", "answer": "Neither wins universally. Realtime models tend to sound more natural; cascaded setups give more control and flexibility with models. The right choice depends on your priorities and on testing with your own scripts and callers."},
    {"question": "Do I need to choose between them as a customer?", "answer": "Not necessarily. On Purple Voice the AI layer is managed by the team for each customer and can use OpenAI Realtime, Gemini Live or a cascaded Deepgram plus Claude, OpenAI or Gemini setup."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-07-18"
}
---
The realtime vs cascaded voice AI choice comes down to one question: do you want a single model that handles listening and speaking directly, or a pipeline of separate parts you can inspect and swap? Realtime models usually sound more natural and respond faster. Cascaded pipelines give you more control and more choice of components.

Neither is better in every case. This article explains how each works, where they differ in practice on phone calls, and how to decide.

## The two architectures

### Cascaded (the pipeline)

A cascaded agent chains three steps:

1. **Speech-to-text (STT).** The caller's audio becomes text.
2. **Language model (LLM).** The text, plus instructions and knowledge, becomes a reply in text.
3. **Text-to-speech (TTS).** The reply becomes audio.

Each step can come from a different provider. For example, Deepgram for speech recognition, Claude, OpenAI or Gemini for the language model, and a separate voice engine for speech.

### Realtime (speech-to-speech)

A realtime model takes audio and produces audio directly. There is no explicit text step in the middle, so the model can pick up on pace, emphasis and pauses, and it can produce natural-sounding replies with brief acknowledgements. OpenAI Realtime and Gemini Live are examples of this approach.

If you want the full walk-through of what happens in each stage, read [how AI voice agents work](/blog/how-ai-voice-agents-work).

## Latency and naturalness

Latency is the gap between the caller finishing and the agent starting to reply. Past a second or so, a call starts to feel awkward.

- **Realtime models** have fewer hand-offs, so the time to first audio is often shorter. They also tend to handle interruptions fluidly, because the same model is listening and speaking.
- **Cascaded pipelines** add the delay of each step. Streaming helps a great deal: start transcribing while the person talks, start generating as soon as a turn ends, start speaking from the first few words. A tuned pipeline can feel quick, but there are more places for delay to creep in.

Naturalness is similar. Direct speech models can carry tone and rhythm across a conversation. A pipeline's voice is only as expressive as its TTS stage, and it never hears the caller's tone, only their words.

## Control and observability

This is where cascaded setups have the edge.

- **You can see the text.** The transcript between steps lets you log, search and audit exactly what was heard and said.
- **You can intervene.** Filter words, enforce phrasing, correct pronunciations or insert fixed compliance lines.
- **You can swap components.** If a better recogniser for your accents appears, change that one part.
- **You can tune each stage separately.** Faster model for simple turns, stronger model for complex ones.

Realtime models give less visibility into the middle. Most platforms still produce transcripts, but the model's internal decisions are less steerable, and some behaviours are harder to constrain.

## Comparison table

| Factor | Realtime (speech-to-speech) | Cascaded (STT, LLM, TTS) |
| --- | --- | --- |
| Typical response speed | Often faster | Good when streamed and tuned |
| Sounds natural | Often very natural | Depends on the TTS voice |
| Interruption handling | Fluid | Needs careful tuning |
| Control over wording | Less | More |
| Component choice | Limited to provider | Mix and match |
| Debugging | Harder | Easier, text between stages |
| Cost structure | Provider-specific | Sum of three parts |
| Tool use | Supported, varies by provider | Mature and flexible |
| Languages and voices | Provider-dependent | Wide choice per stage |

## When realtime tends to fit

- Conversations where feel matters most: warm inbound calls, hospitality, light-touch qualification.
- Short, back-and-forth exchanges with lots of interruptions.
- Cases where a slight loss of control is acceptable in return for fluidity.

## When cascaded tends to fit

- Scripts with strict wording or legal lines that must be spoken exactly.
- Specialised vocabulary, names or accents where you want to choose the best recogniser.
- Teams that need detailed logging and auditability.
- Cases where you want to use a particular language model for reasoning quality.
- Situations where cost per minute needs careful tuning.

## What actually breaks on real calls

Whichever you pick, the issues that most often hurt phone conversations are the same.

- **Noisy lines.** Phone audio is compressed and often noisy.
- **Names and numbers.** Misheard emails, phone numbers and spellings.
- **Over-eager interruption handling.** The agent stops because of background noise.
- **Long replies.** Even a fast model sounds slow when it talks for twenty seconds.
- **Weak instructions.** A model cannot fix an unclear goal. See [how to write an AI voice agent prompt](/blog/how-to-write-an-ai-voice-agent-prompt).

This is why the architecture matters less than testing. Compare them on your own calls, not on a demo.

## A practical way to compare

1. **Write a test set.** Ten realistic calls, including three awkward ones: an interruption, a vague request and an off-topic question.
2. **Run both configurations on the same set.**
3. **Score on four things:** response gap, accuracy of captured details, adherence to your instructions and how the voice feels.
4. **Listen to the recordings,** not only the transcripts.
5. **Repeat with real traffic** on a small batch.

Review results using a simple rubric, such as the [call quality scorecard](/resources/call-quality-scorecard).

## Why this is managed for you in Purple Voice

Choosing and tuning the AI layer takes effort and changes quickly as providers release new models. In Purple Voice, the AI layer is managed by the team per customer. Depending on the use case, that can be OpenAI Realtime, Gemini Live, or a cascaded setup with Deepgram speech and Claude, OpenAI or Gemini. You work with the agent itself: prompt, voice, knowledge and test calls. Your phone numbers stay yours, through Twilio, Plivo or SuperPhone, and phone and AI usage are billed by those providers.

That also means this decision is not locked in. If a different setup works better for your calls, it can be changed without rebuilding your agent.

## Cost and planning

Because pricing differs, avoid comparing list prices for single components. Instead, estimate the cost of a typical call: its length, how much the agent talks and how many tool calls it makes. For how those costs fit together, see [AI voice agent pricing explained](/blog/ai-voice-agent-pricing-explained).

## Try it

You do not need to pick an architecture to find out if a voice agent suits your calls. Set up an agent on the Purple Voice Free plan, which includes one agent, one number and 100 minutes a month with no card, and place test calls to your own phone. Start at [voice.purplerocket.co](https://voice.purplerocket.co) and judge the result by how it sounds on your calls.
