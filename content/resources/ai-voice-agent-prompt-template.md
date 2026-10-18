---
{
  "slug": "ai-voice-agent-prompt-template",
  "title": "AI voice agent prompt template: a fill-in-the-blank starting point",
  "seoTitle": "AI voice agent prompt template: copy, fill in and test (2026)",
  "seoDescription": "A copy-paste AI voice agent prompt template with every section explained: role, goal, style, facts, flow, guardrails and handoff. Fill in the brackets and test.",
  "excerpt": "A complete prompt skeleton for a sales voice agent, with guidance on what to write in each section and a filled-in example for a lead follow-up call.",
  "focusKeyword": "ai voice agent prompt template",
  "secondaryKeywords": ["voice agent prompt", "ai calling prompt example", "system prompt for voice agent"],
  "category": "Templates",
  "tags": ["prompts", "agents", "templates"],
  "cover": "/images/resources/covers/ai-voice-agent-prompt-template.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What should an AI voice agent prompt include?", "answer": "At minimum: who the agent is, what the call is for, how it should sound, the facts it may use, the order of questions, what to do with objections and when to hand over to a human. Add rules for things it must never do."},
    {"question": "How long should a voice agent prompt be?", "answer": "Long enough to cover the call and short enough to read in a few minutes. Move reference material such as pricing details and FAQs into a knowledge base instead of the prompt."},
    {"question": "Should I write the exact words the agent says?", "answer": "Only for the opening line and any legally important statements. For everything else, describe the goal and give examples, so the agent can respond naturally when the conversation goes off script."},
    {"question": "How do I stop an AI voice agent making things up?", "answer": "Tell it explicitly to say it will check and follow up when it does not know, restrict it to the facts in the knowledge base and test it with questions you know it cannot answer."},
    {"question": "How often should I update the prompt?", "answer": "After every batch of calls at first. Read a handful of transcripts, note where the agent stumbled and change one thing at a time so you can see what helped."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-07-09"
}
---
An AI voice agent prompt template gives you a structure to fill in so that you do not forget the parts that matter: the goal, the tone, the facts and the rules. Copy the skeleton below, replace everything in [brackets], and then place a test call to your own phone before you point the agent at real leads.

For the thinking behind each section, see [how to write an AI voice agent prompt](/blog/how-to-write-an-ai-voice-agent-prompt).

## The full AI voice agent prompt template

```
# Role
You are [Agent name], a [role] at [Company]. You are speaking on the phone
with [a lead who enquired about X / a customer who called us].

# Goal of this call
Your single goal is to [book a 15-minute call / qualify the lead / confirm
interest]. A successful call ends with [specific outcome].

# Who you are talking to
[Short description of the typical contact and why they are being called.
Use the variables: name = {{first_name}}, source = {{lead_source}}.]

# Voice and style
- Speak in short, plain sentences. One idea at a time.
- Sound calm and friendly, not scripted and not pushy.
- Ask one question, then stop and listen.
- If interrupted, stop talking and respond to what the person said.
- Do not use jargon. Do not read lists aloud unless asked.

# Opening line
Say exactly: "[Opening line, including your name, company and the reason
for the call.]"
[If required where you call: "I'm an AI assistant calling on behalf of
Company."]

# Conversation flow
1. Confirm you are speaking with the right person.
2. [Question 1]
3. [Question 2]
4. [Question 3]
5. If they are a fit and interested, [book / transfer].
6. Confirm any details back, thank them, end the call.
Skip any question the person has already answered.

# Facts you may use
Use only the information in the knowledge base. If you do not know
something, say "I'll check that and have someone follow up", and note it.
Never invent prices, dates, guarantees or availability.

# Objections
- "Not interested": acknowledge, ask one short question about why, then
  accept the answer and end politely.
- "Send me an email": agree, confirm the address, end the call.
- "How much is it?": [answer or redirect].
- "Who is this? / Is this a robot?": answer honestly.

# Booking
Offer two specific time slots from the calendar. Read back the date, time
and email address before confirming.

# Hand-off to a human
Transfer when: [the person asks for a human / the person is ready to buy /
the question is outside what you know]. Before transferring, say you are
connecting them and briefly state what they want.

# Hard rules
- Stop calling and mark do not call if the person asks.
- Never pressure. Never argue.
- Never give legal, medical or financial advice.
- End the call politely if the person is abusive.
```

## What to write in each section

| Section | What good looks like | Common mistake |
|---|---|---|
| Role | One line: name, company, situation | A long company history the agent will never use |
| Goal | A single outcome | Three goals that compete |
| Voice and style | 4-6 concrete behaviours | Adjectives only ("friendly, professional") |
| Opening line | Exact words, under 20 seconds | A paragraph about the company |
| Flow | Ordered questions with exits | A rigid script with no branches |
| Facts | Short, or pointed to a knowledge base | Pasting your whole website |
| Objections | The five you hear most | Trying to cover every possible reply |
| Hard rules | Short, absolute | Vague "be careful" instructions |

## A filled-in example

Here is a compact version for a service business following up on web enquiries.

```
# Role
You are Sam, an assistant at Brightside Plumbing. You are calling someone
who filled in our contact form today.

# Goal of this call
Book a visit with a plumber. A successful call ends with a confirmed
day, time and address.

# Opening line
Say exactly: "Hi, this is Sam, an AI assistant calling from Brightside
Plumbing. You asked us about a leaking tap earlier. Is now an okay
moment?"

# Conversation flow
1. Ask what the problem is and how urgent it feels.
2. Ask for the address and the best number to reach them.
3. Offer two available visit slots.
4. Read back the details and confirm.
```

This is illustrative, so adapt the wording to your own business and rules.

## Tuning tips

- Change one thing at a time. If you edit five lines and calls improve, you will not know which one worked.
- Put anything long (price lists, service areas, policies) in the knowledge base, and keep the prompt about behaviour.
- Test the awkward paths: silence, a wrong number, an angry person, a question you did not plan for.
- Re-read the [cold call script templates](/resources/cold-call-script-templates) when you need alternative openers, and use the [call quality scorecard](/resources/call-quality-scorecard) to judge transcripts consistently.

## Try it

Paste this template into a new agent in Purple Voice, add your knowledge base and place a test call to your own phone. The Free plan includes one agent and 100 minutes a month, with no card needed. Start at [voice.purplerocket.co](https://voice.purplerocket.co), and run through the [launch checklist](/resources/ai-voice-agent-launch-checklist) before you call real contacts.
