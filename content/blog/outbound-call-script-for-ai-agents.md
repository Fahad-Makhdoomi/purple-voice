---
{
  "slug": "outbound-call-script-for-ai-agents",
  "title": "Outbound call scripts for AI agents: write a brief, not a script",
  "seoTitle": "Outbound call script for AI agents: how to write one that works",
  "seoDescription": "An outbound call script written for a human reader fails when an AI agent reads it aloud. Learn how to turn a script into a brief the agent can actually use.",
  "excerpt": "A word-for-word outbound call script makes an AI agent sound like it is reading. Here is how to turn a script into goals, branches and guardrails instead.",
  "focusKeyword": "outbound call script",
  "secondaryKeywords": ["sales call script for ai", "ai calling script", "cold call script ai agent"],
  "category": "Playbooks",
  "tags": ["scripts", "outbound", "prompts"],
  "cover": "/images/blog/covers/outbound-call-script-for-ai-agents.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "Do AI voice agents need an outbound call script?", "answer": "They need something script-like, but not a word-for-word script. A short brief with a goal, a few key lines, branches for common answers and firm limits works better than a full transcript, because the agent can then respond to what the person actually says."},
    {"question": "How long should an outbound call script be for an AI agent?", "answer": "Most good briefs fit on one to two pages. If you cannot summarise the call's purpose in one sentence and the main branches in a short list, the call is probably trying to do too much."},
    {"question": "Should an AI agent read the opener exactly as written?", "answer": "Usually yes for the first line or two, because the opener is the part that benefits most from careful wording and is the least dependent on the prospect's reply. After that, let the agent paraphrase."},
    {"question": "How do I stop an AI agent going off script?", "answer": "Give it clear limits rather than a longer script. Say what it must not discuss, what it should do when it does not know, and when to end the call or transfer to a person."},
    {"question": "Can I reuse my human SDR script for an AI agent?", "answer": "Reuse the thinking, not the format. Your best SDR's openers, qualifying questions and objection answers are valuable raw material, but they need restructuring into goals and branches before an agent can use them."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-07-03"
}
---
An outbound call script written for a human to read aloud will make an AI voice agent sound like it is reading. The fix is not a better script. It is a brief: a short document that tells the agent what the call is for, what to say first, what to find out, how to react to the common replies, and where its limits are.

This article shows how to convert an existing outbound call script into that kind of brief, with a worked example you can adapt. If you want the prompt-writing mechanics, the companion piece on [how to write an AI voice agent prompt](/blog/how-to-write-an-ai-voice-agent-prompt) goes step by step.

## Why a word-for-word outbound call script fails with AI

A script assumes the call goes in a straight line: opener, pitch, question, answer, next question. Real calls do not. People interrupt, answer two questions at once, ask something off-topic, or say "who is this?" in the middle of your carefully timed pitch.

A human SDR copes because they treat the script as scaffolding. They skip lines, merge them, and improvise. An AI agent given a rigid script does one of two things. It either follows the script mechanically, which sounds stilted and ignores what the person just said, or it improvises with nothing to guide it, which sounds fluent but drifts.

A brief avoids both. It fixes the parts that should be fixed (the opening, the facts, the limits) and leaves the connective tissue to the agent. If you want to understand why the agent can handle that kind of flexibility, [how AI voice agents work](/blog/how-ai-voice-agents-work) explains the speech and language layers underneath.

## The five parts of a call brief

### 1. One-sentence purpose

Write what the call must achieve in a single sentence, in plain words. For example: "Confirm the person asked about a roof survey, check they own the property, and book a 30-minute visit if they do."

That sentence does more work than a page of dialogue. Every decision the agent makes mid-call can be checked against it: does this move us toward the survey booking or not?

### 2. The opener, written out

This is the one part worth scripting nearly word for word. The opener decides whether the person stays on the line, so it deserves care. A good opener does four things in under ten seconds: says who is calling, gives a reason tied to something the person did, asks a low-effort question, and sounds like a person.

Write it as one or two sentences, and tell the agent it may vary the phrasing slightly but must keep the structure. For more on what works here, see [cold call opening lines](/blog/cold-call-opening-lines).

### 3. What to find out

List the facts the agent needs, not the questions to ask. "Whether they own or rent. Roughly how old the roof is. When they want it done." The agent decides how to phrase each one and in what order, which lets it pick up information the person volunteers without asking again.

Keep this list short. Three to five items is typical. Every extra item lengthens the call and raises the chance someone hangs up.

### 4. Branches for common replies

This replaces the script's straight line. Write a short list of "if they say X, do Y" entries:

- If they say it is a bad time, offer a specific callback window and confirm it.
- If they ask who you are, say the company name and why you are calling, in one sentence.
- If they ask whether this is a recording or an AI, answer honestly.
- If they ask about price, give the range from the knowledge base if there is one, otherwise say a person will confirm and offer to book the call.
- If they say they are not interested, acknowledge it once, ask one short question about why only if it is useful, then end politely.

The point is to cover the five or six replies you hear on most calls, not all of them. Longer objection material belongs in a knowledge base; the library approach is covered in [handling objections with an AI voice agent](/blog/handling-objections-with-ai-voice-agent).

### 5. Limits

State what the agent must not do. Typical limits: do not promise prices or timelines that are not in the knowledge base, do not argue with someone who has said no, do not keep calling someone who asks to be removed, and end the call or transfer to a person for anything involving complaints or legal questions.

Limits are the part people skip, and the part that protects your brand most.

## A worked example: before and after

Here is a typical human script fragment for a home-services lead:

> "Hi, is that Sarah? Great. My name's Tom from Brightside Roofing. I'm calling because you filled out our form about a roof inspection. Now, we've been doing this for twelve years and we pride ourselves on... [continues for four lines]. So, do you own the property? And when was the roof last done? Brilliant. Now, we have availability on Tuesday at 10 or Thursday at 2, which works better?"

And the same material as a brief (illustrative):

> **Purpose:** Confirm the person asked for a roof inspection, check they own the property, and book a 30-minute inspection.
>
> **Opening (keep close to this):** "Hi, is that Sarah? This is the assistant at Brightside Roofing. You asked us about a roof inspection online this morning, so I'm calling to arrange a time. Is now a reasonable moment?"
>
> **Find out:** Owner or tenant. Rough age or condition of the roof. Preferred days and mornings or afternoons.
>
> **Branches:** If not a good time, offer a callback and confirm the time. If they ask about price, say inspections are free and quotes follow the visit. If they are a tenant, thank them and end the call.
>
> **Limits:** Do not quote prices for repairs. Do not discuss warranties beyond what is in the knowledge base. If asked for a person, transfer.

The brief is shorter than the script and leaves out the sales patter. That patter is not what books inspections. A clear, relevant reason for the call does.

## A quick comparison

| | Traditional script | Call brief |
|---|---|---|
| Structure | Linear dialogue | Goal, opener, facts, branches, limits |
| Handles interruptions | Poorly | Well, because there is no fixed order |
| Length | Often two or three pages | Usually one or two |
| Who it suits | A human who can improvise | An agent that needs boundaries |
| Maintenance | Rewrite the whole thing | Edit one section |

## Testing the brief before it touches a lead

Run a handful of test calls yourself before launch. Purple Voice lets you trigger a test call to your own phone from the agent editor, so you can play the part of a difficult prospect. Try the awkward ones: interrupt mid-sentence, give a vague answer, ask something the agent cannot know, say you are busy. The point is to see where the brief is silent, then add a line.

After launch, read real transcripts. Patterns show up quickly: a question people keep asking that the knowledge base does not cover, an opener that gets hang-ups, a branch the agent handles badly. The loop is covered in [improve your AI agent with call transcripts](/blog/improve-ai-agent-with-call-transcripts).

## Common mistakes

- **Pasting the whole script into the prompt.** The agent will try to follow it and sound robotic.
- **No exit conditions.** Without them calls drag on, or the agent keeps pushing past a clear no.
- **Too many goals.** Qualifying, booking, upselling and surveying in one call is a recipe for a confused agent and a frustrated prospect.
- **Hiding that it is an AI.** If the person asks, say so. Compliance rules in many places also push towards disclosure; the subject is covered in [disclose AI on calls](/blog/disclose-ai-on-calls).

## Try it

The quickest way to feel the difference between a script and a brief is to write one and call yourself. Purple Voice has a Free plan with no card required, which includes one agent and 100 minutes a month, enough to write a brief, run test calls on your own phone and refine it. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
