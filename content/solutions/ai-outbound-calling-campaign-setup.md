---
{
  "slug": "ai-outbound-calling-campaign-setup",
  "title": "AI outbound campaign setup: list, hours, retries and review",
  "seoTitle": "AI outbound campaign setup | list, hours, retries (guide)",
  "seoDescription": "AI outbound campaign setup in six steps: clean the list, set calling hours, choose up to 5 retries, test the agent and read results. A practical walkthrough.",
  "excerpt": "How to configure an outbound AI calling campaign: what the list needs, how to choose calling hours and retries, and what to check before and after launch.",
  "focusKeyword": "ai outbound campaign setup",
  "secondaryKeywords": ["set up ai calling campaign", "outbound campaign calling hours", "ai call retries", "upload contact list ai calls"],
  "category": "Outbound calling",
  "tags": ["outbound-calling", "campaigns", "setup"],
  "cover": "/images/solutions/covers/ai-outbound-calling-campaign-setup.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "How do I set up an AI outbound calling campaign?", "answer": "Prepare a clean list, build and test the agent, create a campaign with that agent, set calling hours and retries, confirm consent where required and start with a small batch. Review the first calls before scaling."},
    {"question": "What should a contact list for AI calling include?", "answer": "A phone number in a consistent international format, a first name and any context the agent needs for its opening line, such as the product enquired about. Remove duplicates and numbers you must not call."},
    {"question": "How many retries should an outbound campaign use?", "answer": "Purple Voice allows up to 5 retries per contact with their own retry hours. Many teams use fewer to avoid feeling pushy, and spread attempts across mornings, afternoons and different days."},
    {"question": "What are good calling hours for outbound AI calls?", "answer": "Hours depend on who you are calling and local rules. Use reasonable local daytime or early-evening windows, respect time zones and check the legal limits that apply in your region."},
    {"question": "How do I know if a campaign is working?", "answer": "Look at the not-reached analytics, the number of booked appointments or qualified calls and a sample of transcripts. A call that connects but ends without a clear outcome points to a prompt problem."}
  ],
  "howToSteps": [
    {"name": "Prepare the list", "text": "Clean numbers, remove duplicates and add the context fields the agent will use in its opening."},
    {"name": "Build and test agent", "text": "Write the prompt, add knowledge, then call your own phone and tweak until it sounds right."},
    {"name": "Set hours and retries", "text": "Choose calling windows and up to 5 retries, with separate retry hours."},
    {"name": "Launch small, review", "text": "Start with a short batch, read transcripts and summaries, then widen the list."}
  ],
  "publishedAt": "2026-10-22"
}
---
AI outbound campaign setup comes down to four decisions: who you call, what the agent says, when it calls and what happens when nobody answers. Get those four right and the dashboard does the rest. This guide walks through them in the order you will meet them in Purple Voice, with checks that save you from the most common first-campaign mistakes. If you want the wider system first, start with the [AI outbound calling system overview](/solutions/ai-outbound-calling-system).

## What to prepare before the AI outbound campaign setup

Before you open the Campaigns page, have these ready:

- **A list you are allowed to call.** Know where each number came from and what the person agreed to.
- **One agent with one goal.** Booking, confirming or qualifying. Not all three on the first run.
- **A phone number connected to your account.** Rented from Twilio, Plivo or SuperPhone and billed by them.
- **Calendar access.** Connect Google Calendar if the agent will book.
- **A person to read results.** Someone has to check summaries every day in week one.

## Building the contact list

A campaign list is small and plain:

- **Phone number** in one consistent format, including country code.
- **First name**, used in the greeting.
- **Context** the agent can mention, such as the enquiry, the property or the appointment time.
- **Nothing sensitive** that the agent does not need.

Clean it before upload. Remove duplicates, landlines you know will not answer, and anyone on your internal do-not-call list. The Free plan allows 100 contacts per campaign, and Basic does too, so start with a tight list anyway. Pro removes the contact cap.

## Calling hours and retries

Calling hours are the windows in which the system is allowed to dial. Set them in the contact's likely local time, inside any legal limits that apply to you.

Retries are the second chance system. You can set up to 5 retries per contact and give retries their own hours. Practical choices:

| Situation | Suggested pattern (illustrative) |
|---|---|
| Fresh web lead | First attempt soon after enquiry, then 2 retries across the next day |
| Appointment reminder | 1 retry a few hours later, nothing after the appointment starts |
| Old database | 3 retries over a week, different times of day |
| Survey | 2 retries at different times, then stop |

More retries is not always better. A person who has missed three calls from you does not need a fourth the same afternoon. See [reducing missed contact on old lists](/blog/reactivate-old-leads-with-ai-calls) for pacing ideas.

## A sample call

Illustrative, for a gym free-trial follow-up.

**Agent:** Hello, is this Priya? I am calling for a local gym about the free trial pass you signed up for. Have you got a minute?

**Caller:** Yes, I meant to use it but forgot.

**Agent:** That happens. The pass is valid until the end of next week. Would you like me to book a session so you have a time in the diary?

**Caller:** Saturday morning if possible.

**Agent:** Saturday at 9:30 is open. Shall I put you down?

**Caller:** Yes please.

**Agent:** Done. You will receive confirmation, and if you need to move it just call this number.

## Pre-launch checklist

1. **Test the agent on your own phone** and try to break it with interruptions and off-topic questions.
2. **Check the knowledge base** for every fact the agent could be asked.
3. **Test the booking path** end to end and confirm the event lands in the right calendar.
4. **Set a transfer rule** if a human should take hot calls, using the [warm transfer guide](/blog/warm-transfer-ai-to-human).
5. **Confirm consent** in the campaign where your rules require it.
6. **Launch with 20 to 30 contacts**, not the whole list.
7. **Read every summary** from the first day.

The [AI voice agent launch checklist](/resources/ai-voice-agent-launch-checklist) covers the same ground in printable form. For a longer treatment, see [how to launch an AI calling campaign](/blog/how-to-launch-an-ai-calling-campaign).

## Reading the results

The progress bar shows how far through the list you are. The not-reached analytics tells you which contacts never picked up after all retries, which is a list quality signal, not an agent signal. Calls that connect but go nowhere are where prompts need work, so read those transcripts first. Adjust one thing at a time so you know what helped.

## Where campaign setup falls short

- **A tidy setup cannot rescue a poor list.** If the numbers are old or consent is unclear, stop and fix that first.
- **Hours cannot guarantee answers.** People are busy, and some will never pick up unknown numbers. Caller ID and number reputation matter, covered in [caller ID for AI outbound](/solutions/ai-outbound-calling-caller-id-and-number-reputation).
- **Complex campaigns need a person.** Multi-stakeholder, regulated or emotional calls should not run unattended.
- **Rules differ by region.** This is general information, not legal advice. Read the [compliance overview](/solutions/ai-outbound-calling-compliance) and check current local rules.

## Try it

Create your first campaign on the Free plan: no card, 100 minutes a month, up to 100 contacts. Number rental and AI usage are billed by those providers, not Purple Voice. Sign up at [voice.purplerocket.co](https://voice.purplerocket.co) and compare tiers on the [pricing page](/pricing).
