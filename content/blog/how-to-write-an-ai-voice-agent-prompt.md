---
{
  "slug": "how-to-write-an-ai-voice-agent-prompt",
  "title": "How to write an AI voice agent prompt that holds up on real calls",
  "seoTitle": "How to write an AI voice agent prompt: structure, persona, guardrails",
  "seoDescription": "A step-by-step method for writing an AI voice agent prompt: role, goal, tone, call flow, knowledge and guardrails, with an example you can adapt today.",
  "excerpt": "Voice prompts are not chat prompts. Here is a six-part structure for an AI voice agent prompt, with an example and the mistakes that cause awkward calls.",
  "focusKeyword": "ai voice agent prompt",
  "secondaryKeywords": ["voice agent system prompt", "ai calling prompt", "how to prompt a voice agent"],
  "category": "Playbooks",
  "tags": ["prompts", "agent-setup", "how-to"],
  "cover": "/images/blog/covers/how-to-write-an-ai-voice-agent-prompt.webp",
  "schemaType": "HowTo",
  "faq": [
    {"question": "What is an AI voice agent prompt?", "answer": "It is the written instruction set that tells a voice agent who it is, what the call is for, how to speak, what it knows and what it must not do. The agent reads it before every call and uses it to decide what to say."},
    {"question": "How long should a voice agent prompt be?", "answer": "Long enough to cover purpose, tone, flow, facts and limits, and no longer. Many working prompts run between 300 and 800 words, with detailed reference material kept in a knowledge base instead."},
    {"question": "How is a voice prompt different from a chatbot prompt?", "answer": "Voice replies must be short, sound natural when spoken, and tolerate interruption. A voice prompt needs rules about brevity, spoken numbers and dates, and when to stop talking, which a text prompt rarely does."},
    {"question": "Should I put pricing and FAQs in the prompt?", "answer": "Put the few facts needed on almost every call in the prompt, and keep the rest in the knowledge base. A bloated prompt makes the agent less focused and harder to edit."},
    {"question": "How do I know if my voice agent prompt is working?", "answer": "Make test calls to your own phone, then read real transcripts after launch. Look for where the agent rambles, gets stuck, or says something you did not intend, and fix the specific line responsible."}
  ],
  "howToSteps": [
    {"name": "Define the role and the single goal", "text": "Write who the agent is, who it is calling or answering for, and one sentence describing what a successful call looks like."},
    {"name": "Set the persona and speaking style", "text": "Describe tone, pace and length of replies, and add rules for spoken numbers, names and dates."},
    {"name": "Write the call flow", "text": "Give the opener in close to final wording, list the facts to collect, and describe the main branches without scripting every line."},
    {"name": "Add the knowledge it needs", "text": "Include the handful of facts needed on most calls and point everything else to the knowledge base."},
    {"name": "Set guardrails and exit rules", "text": "State what the agent must not do or promise, how it handles not knowing, and when it ends the call or transfers to a human."},
    {"name": "Test, read transcripts and revise", "text": "Make test calls to your own phone, fix the specific lines that caused problems, and review real transcripts after launch."}
  ],
  "publishedAt": "2026-07-10"
}
---
A good AI voice agent prompt has six parts: a role and goal, a speaking style, a call flow, a small set of facts, firm guardrails, and a test loop. It reads less like a script and more like a briefing note for a capable new hire who will be on the phone within the hour.

This guide walks through each part with an example, then lists the mistakes that cause awkward calls. If you have a script already, [outbound call script for AI agents](/blog/outbound-call-script-for-ai-agents) shows how to convert it.

## Why a voice prompt is not a chat prompt

Text prompts can lean on long, structured answers. Voice cannot. A paragraph that reads well on screen is exhausting to listen to, and the listener cannot skim. On a call, the agent also gets interrupted, hears messy speech, and has no screen to show a list on.

So a voice prompt has to cover things a chat prompt can ignore: keep replies to one or two sentences, say numbers and dates in a way that sounds natural, stop talking when interrupted, and ask one question at a time. For why those matter technically, see [AI voice agent latency and natural conversation](/blog/ai-voice-agent-latency-and-natural-conversation).

## Step 1: define the role and the single goal

Open with who the agent is and what the call is for. Keep it concrete.

> You are the voice assistant for Harbour Dental. You call people who requested a quote for teeth whitening. Your goal on every call is to book a 20-minute consultation, or to find out clearly that they no longer want one.

Two things matter here. First, name the organisation and the relationship to the person: who they are to you and why you are calling. Second, give one goal. A prompt with three equal goals produces calls that wander.

## Step 2: set the persona and speaking style

Describe how the agent should sound, in practical terms rather than adjectives alone. "Friendly" means little. This means more:

- Speak in short sentences. Usually one or two per turn.
- Ask one question at a time and wait for the answer.
- Use the person's first name once or twice, not every sentence.
- Say prices and times the way a person would: "about two hundred pounds", "Tuesday at ten in the morning".
- If the person interrupts, stop and respond to what they said.
- Do not read lists out. Offer two options at most.

The voice itself (the actual sound) is chosen separately in the agent settings. The prompt controls the manner, and the two should match: a brisk, warm style suits most sales follow-up; a slower, calmer one suits clinics.

## Step 3: write the call flow

This is where most prompts either say too little or too much. Give the structure and the opener, then let the agent handle the rest.

**Opener.** Write it close to final. It is the one part of the call that benefits from exact wording. Example: "Hi, is that Priya? This is the assistant at Harbour Dental. You asked about whitening on our website, so I'm calling to see if you'd like to book a short consultation. Is now an okay time?"

**Facts to collect.** List them as things to find out, not as questions: "whether they have had whitening before; whether they are looking at the next month or later; preferred days."

**Branches.** A short list of the likely turns:

- Not a good time: offer a specific callback window and confirm it.
- Asks about price: give the starting price from the knowledge base and say the dentist confirms after the consultation.
- Asks if you are a robot: say yes, you are an AI assistant, and offer to continue or have someone call back.
- Not interested: acknowledge once, thank them, end the call.

For a deeper look at what to do when people push back, [handling objections with an AI voice agent](/blog/handling-objections-with-ai-voice-agent) covers a knowledge-base approach.

**Close.** Tell the agent how to finish: confirm the booking details out loud, say what happens next, and say goodbye. Without an explicit close, agents sometimes keep chatting.

## Step 4: add the knowledge it needs

Be selective. The prompt should contain the facts used on nearly every call: company name, what you offer in one sentence, hours, location, a headline price or range if you can share it, and how booking works.

Everything else (detailed FAQs, policy wording, product comparisons) belongs in a knowledge base the agent can look things up in. In Purple Voice this is part of the agent setup alongside the prompt and voice. Keeping the prompt lean makes it easier to read, easier to edit, and less likely to contradict itself.

Tell the agent what to do when the answer is not there: "If you do not know, say so and offer to have someone follow up. Never guess."

## Step 5: set guardrails and exit rules

Guardrails are the part that protects you. Write them as plain, specific statements:

- Do not promise outcomes, discounts or timelines that are not in the knowledge base.
- Do not give medical, legal or financial advice.
- Do not continue after the person says they do not want to be called. Confirm you will not call again and end the call.
- Do not argue. After one gentle response to an objection, accept the answer.
- Transfer to a human if the person asks for one, is upset, or raises a complaint. See [warm transfer from AI to human](/blog/warm-transfer-ai-to-human) for how to handle the handoff.

Add the exit conditions too: when to end the call (booked, declined, wrong person, voicemail) and what to say.

## Step 6: test, read transcripts, revise

A prompt is not finished when it is written. Run test calls to your own phone from the agent editor and act badly on purpose: interrupt, mumble, change the subject, ask for a discount. Note each point where the agent does something you would not want, and trace it to a missing or unclear line in the prompt.

After launch, read real call transcripts and summaries. You will see patterns within the first few dozen calls. Fix one thing at a time so you know which edit caused which change. The loop is described in [improve your AI agent with call transcripts](/blog/improve-ai-agent-with-call-transcripts).

## A compact prompt skeleton

Use this as a starting shape, not a template to fill blindly:

| Section | What to write | Typical length |
|---|---|---|
| Role and goal | Who you are, who you call, what success is | 2 to 4 sentences |
| Speaking style | Tone, brevity, spoken numbers, interruptions | 5 to 8 bullets |
| Call flow | Opener, facts to collect, branches, close | 100 to 250 words |
| Key facts | Only what is needed on most calls | 5 to 10 lines |
| Guardrails | Never-do list, not-sure behaviour, transfer rules | 5 to 8 bullets |

## Mistakes that cause awkward calls

- **Writing the prompt as dialogue.** The agent starts reciting it.
- **Burying the goal.** If the goal is in paragraph four, it will often lose to whatever the person says first.
- **Vague style words.** "Professional and engaging" does not tell the agent how long to talk.
- **Stuffing the prompt with FAQs.** Use the knowledge base.
- **No rule for not knowing.** Agents that are never told to say "I'm not sure" will sometimes guess.
- **Changing five things at once.** You will not know what fixed or broke the call.

## Try it

You can write your first prompt and hear it on your own phone in a single sitting. Purple Voice has a Free plan, no card needed, with one agent and 100 minutes a month, which is enough to run the whole write, test and revise loop above. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
