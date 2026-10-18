---
{
  "slug": "appointment-booking-script-templates",
  "title": "Appointment setting script templates for AI voice agents",
  "seoTitle": "Appointment setting script templates: 5 booking flows you can copy",
  "seoDescription": "Copy-ready appointment setting script templates for outbound, inbound and reschedule calls, written so an AI voice agent can book on your calendar.",
  "excerpt": "Five booking flows, from outbound follow-up to reschedules, with the exact wording and the branches that matter. Adapt them to your own agent prompt.",
  "focusKeyword": "appointment setting script",
  "secondaryKeywords": ["appointment booking script", "booking call script", "appointment setter script"],
  "category": "Scripts",
  "tags": ["scripts", "appointments", "booking"],
  "cover": "/images/resources/covers/appointment-booking-script-templates.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is a good appointment setting script?", "answer": "A good appointment setting script states who is calling and why in one sentence, asks one qualifying question, offers two specific time slots, and confirms the details back. It stays short because the goal is a booked slot, not a full sales conversation."},
    {"question": "How do you offer times on an appointment setting call?", "answer": "Offer two concrete options rather than asking 'when are you free?'. Open-ended questions stall the call. If neither works, ask for a day and a time of day and offer the closest open slots."},
    {"question": "Can an AI voice agent follow an appointment setting script?", "answer": "Yes, but it works better with a goal and a few rules than a rigid script. Give the agent the flow below as guidance, plus the questions it must ask, and let it handle interruptions and tangents naturally."},
    {"question": "How do you reduce no-shows on booked appointments?", "answer": "Confirm the time and the reason for the meeting before ending the call, send a written confirmation, and make rescheduling easy. A short reminder call or message close to the time helps many teams."},
    {"question": "How long should an appointment booking call be?", "answer": "Most booking calls work best under two or three minutes. If the lead has many questions, answer the important ones and book the meeting where the detail can be covered properly."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-07-04"
}
---
An appointment setting script has one job: get from "hello" to a confirmed slot in as few turns as possible, without sounding like you are rushing the person. The five templates below cover the situations that come up most often. They are written to be pasted into an agent prompt as guidance, not read aloud word for word.

Words in [brackets] are fill-ins. Lines marked **Agent** are what the agent says; lines marked **If** are branches.

## How an appointment setting script should be built

Every booking flow has the same five beats. If you keep them in order, the details can change freely.

1. **Identify and give a reason.** Name, company, one sentence on why you are calling.
2. **Check it is a good moment.** One short question.
3. **Confirm the need.** One or two questions, no more.
4. **Offer two specific slots.** Never "whenever suits you".
5. **Confirm and close.** Repeat date, time, channel and what happens next.

For writing the surrounding prompt, see [how to write an AI voice agent prompt](/blog/how-to-write-an-ai-voice-agent-prompt) and the [fill-in-the-blank prompt template](/resources/ai-voice-agent-prompt-template).

## Template 1: outbound follow-up to a web enquiry

Use when someone filled in a form and you are calling quickly.

**Agent:** Hi [first name], it's [agent name] calling from [company]. You asked about [service] on our website a few minutes ago, is now an okay moment for a quick call?

**If yes:** Great. So I can point you to the right person, what are you hoping to sort out?

**Agent (after the answer):** That's something we do regularly. The best next step is a [length]-minute call with [person/role] who can go through options. I have [slot A] or [slot B], which is better?

**Agent (on choice):** Perfect, I've booked [day, date] at [time]. You'll get a confirmation by [email/text] shortly. Anything you'd like [person] to know beforehand?

**If not a good moment:** No problem. When would be better to call you back, later today or tomorrow?

## Template 2: inbound booking call

Use when the agent answers the phone.

**Agent:** Thanks for calling [company], this is [agent name]. How can I help?

**Agent (after the caller states the need):** I can book that for you now. Can I take your name and the best number to reach you?

**Agent:** Thanks, [name]. For [service], I have [slot A] and [slot B] this week. Which suits you?

**Agent:** Booked for [day, date] at [time]. Is there anything we should prepare, such as an address or access details?

**If the caller needs something the agent cannot handle:** Let me put you through to someone who can help. One moment.

## Template 3: qualify first, then book

Use when only some leads should get a human's time.

**Agent:** Before I look at the diary, two quick questions so we send the right person. [Question 1: what are you trying to achieve?] [Question 2: timeframe or budget range?]

**If they meet your criteria:** Based on that, a call with [role] makes sense. I have [slot A] or [slot B].

**If they do not:** Honestly, I don't think we'd be the best fit right now. I can send some information by email if that helps. Would you like that?

Honest routing like this protects your team's calendar. For question ideas, use the [lead qualification questions bank](/resources/lead-qualification-questions-bank).

## Template 4: reschedule or cancel

**Agent:** Hi [name], it's [agent name] from [company] about your appointment on [day] at [time]. Are you still able to make it?

**If yes:** Brilliant, we'll see you then. [One line on location or format.]

**If no:** No problem. I can move it. I have [slot A] or [slot B]. Would either work?

**If they want to cancel:** Understood. Can I ask whether something changed, so we can pass it on? I'll cancel it now and you can rebook any time.

## Template 5: no-show recovery

**Agent:** Hi [name], it's [agent name] from [company]. We had a call booked for [time] and missed you. Everything okay?

**Agent:** If it's still useful, I can rebook. I have [slot A] or [slot B]. Would either work?

Keep the tone light. Many no-shows are schedule clashes rather than lost interest.

## Branches every booking script needs

| Situation | What the agent should do |
| --- | --- |
| Lead asks for a price | Give the range if you have one in the knowledge base, otherwise explain it depends and book the call |
| Lead says "send me an email" | Offer to send it and ask whether to also pencil in a short call |
| Lead is unsure about the time | Ask for a day and time of day, then offer the nearest slots |
| Lead asks "are you a robot?" | Answer honestly that it is an AI assistant, then continue |
| Lead is in a different timezone | Confirm the timezone out loud in the confirmation |
| Lead is irritated | Apologise, offer to stop calling, and end politely |

## Pre-launch checks for booking scripts

- The calendar the agent books into is connected and shows real availability.
- Slots are offered in the lead's timezone, or the timezone is stated.
- The confirmation message goes out on every booking.
- The agent repeats day, date, time and channel before ending.
- A human handover exists for questions the agent cannot answer.

The [Google Calendar booking guide](/blog/google-calendar-booking-with-ai-agent) covers the setup, and the [AI appointment setting overview](/blog/ai-appointment-setting) explains where booking fits in the wider flow.

## Try it

Purple Voice agents book appointments on Google Calendar during the call and send a summary afterwards. Paste one of these templates into an agent prompt, run a test call to your own phone, and adjust the wording until it sounds like your team. The Free plan includes booking and summaries, with no card required. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
