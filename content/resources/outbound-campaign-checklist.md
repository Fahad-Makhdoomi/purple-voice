---
{
  "slug": "outbound-campaign-checklist",
  "title": "Outbound calling campaign checklist: list, hours, consent and retries",
  "seoTitle": "Outbound calling campaign checklist: set up in 7 steps (2026)",
  "seoDescription": "An outbound calling campaign checklist covering list prep, consent, calling hours, retry rules, scripts and review, so your first AI calling campaign runs cleanly.",
  "excerpt": "A step-by-step checklist for setting up an outbound calling campaign: contact list, consent, calling hours, retries, agent readiness and what to review afterwards.",
  "focusKeyword": "outbound calling campaign checklist",
  "secondaryKeywords": ["outbound campaign setup", "calling campaign checklist", "ai calling campaign"],
  "category": "Checklists",
  "tags": ["checklist", "campaigns", "outbound"],
  "cover": "/images/resources/covers/outbound-campaign-checklist.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What goes into an outbound calling campaign checklist?", "answer": "The contact list and its quality, consent and suppression checks, calling hours by time zone, retry rules, the agent's prompt and knowledge, a test run, and a plan for reviewing results. Each step catches a different kind of problem."},
    {"question": "How many times should I retry a contact who does not answer?", "answer": "Purple Voice supports up to 5 retries with set retry hours. Many teams use fewer, spaced across different times of day, because repeated calls close together annoy people without improving answer rates."},
    {"question": "What size should my first campaign be?", "answer": "Small enough to read every transcript, such as 20 to 50 contacts. Scale after you have fixed what the first calls reveal."},
    {"question": "When should an outbound campaign call people?", "answer": "Inside the legal calling hours for the contact's location and at times your audience is likely to answer. Set calling hours in the campaign rather than relying on someone to remember."},
    {"question": "How do I know if a campaign worked?", "answer": "Compare answer rate, qualified rate and booked rate against what you expected, then read a sample of transcripts to understand the numbers. The not-reached analytics help you see why contacts did not connect."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-07-24"
}
---
An outbound calling campaign checklist keeps a launch from turning into a string of avoidable mistakes: a dirty list, calls at the wrong hour, retries that pile up, or no one reading the results. Use the seven steps below before you start a campaign, and keep the final review for after the first day.

If this is your first campaign, pair this with the [AI voice agent launch checklist](/resources/ai-voice-agent-launch-checklist), which focuses on the agent itself. For a narrative walkthrough, see [how to launch an AI calling campaign](/blog/how-to-launch-an-ai-calling-campaign).

## Step 1: the contact list

- [ ] Every row has a phone number in a consistent international format.
- [ ] Duplicates are removed (same number, same person).
- [ ] Each contact has the fields the agent will use: first name, source, anything you reference on the call.
- [ ] Landlines, wrong numbers and obvious test data are removed.
- [ ] The list size is within your plan limit (Free and Basic allow 100 contacts per campaign).
- [ ] You know the country or time zone of each contact.

The [lead list preparation checklist](/resources/lead-list-preparation-checklist) covers formatting and dedupe in more detail.

## Step 2: consent and suppression

General information, not legal advice. Rules differ by country, so check current requirements where you call.

- [ ] You can say why each person is being called (enquiry, opt-in, existing relationship).
- [ ] Do-not-call and suppression lists have been applied to the file.
- [ ] People who previously asked to stop are excluded.
- [ ] You have confirmed consent in the campaign setup where the option is offered.
- [ ] Your opening line discloses that the caller is an AI, where required or where you choose to.

## Step 3: calling hours

| Decision | Suggested approach |
|---|---|
| Daily window | Inside local legal hours for the contact, with a margin at both ends |
| Days of the week | Weekdays unless your audience prefers otherwise |
| Time zones | Group contacts by zone, or limit the campaign to one zone at a time |
| Lunch and late evening | Avoid unless your data says they work |

Set the hours inside the campaign so they apply automatically.

## Step 4: retries

- [ ] A maximum number of attempts is chosen (up to 5 is supported).
- [ ] Retry hours are spread across different times of day.
- [ ] You have decided what counts as a final outcome: answered, declined, wrong number, do not call.
- [ ] Contacts who ask to be removed are never retried.

A simple starting pattern, labelled as an illustration: try a morning slot, then early evening the same day or next, then a different weekday. Adjust once you see when people actually pick up.

## Step 5: the agent

- [ ] The goal is one sentence and the opening line is written word for word.
- [ ] The knowledge base answers the top questions (price, location, how it works).
- [ ] Booking is connected and tested, or transfer rules are defined.
- [ ] You have made a test call to your own phone and tried to break it.
- [ ] The agent knows what to do on voicemail and on a wrong number.

If the agent needs work, use the [prompt template](/resources/ai-voice-agent-prompt-template).

## Step 6: launch small

- [ ] Start with 20 to 50 contacts, not the full list.
- [ ] Someone is available to watch the first calls and pause if needed.
- [ ] Your phone provider account has enough balance.
- [ ] Notifications for bookings, summaries or transfers go to the right person.

## Step 7: review

After the first day, check:

| Question | Where to look |
|---|---|
| How many answered? | Campaign progress and not-reached analytics |
| Why didn't others answer? | Not-reached reasons, time of day |
| Did the agent stay on goal? | A sample of transcripts |
| What objections came up? | Transcripts and summaries |
| What should change? | Prompt, knowledge base, hours or list |

Score a few calls with the [call quality scorecard](/resources/call-quality-scorecard) rather than going on gut feel.

## Common campaign mistakes

- Launching the whole list before reading a single transcript.
- Forgetting time zones, so contacts get calls at odd hours.
- Setting five retries within the same afternoon.
- Treating "not answered" as "not interested" when the data may show a timing problem.

## Try it

In Purple Voice a campaign takes an uploaded list, calling hours, retry hours (up to 5 attempts), consent confirmation and a progress bar, with not-reached analytics once calls start. The Free plan includes one campaign of up to 100 contacts and 100 minutes a month, with no card. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
