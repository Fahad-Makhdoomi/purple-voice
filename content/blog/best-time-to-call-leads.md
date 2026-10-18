---
{
  "slug": "best-time-to-call-leads",
  "title": "The best time to call leads: hours, retries and timezones",
  "seoTitle": "Best time to call leads: how to set hours, retries and timezones",
  "seoDescription": "There is no universal best time to call leads, but there is a sound method. Set hours, vary retries, handle timezones and use your own data to find the window.",
  "excerpt": "Skip the universal best-time charts. Here is a method for choosing calling hours, spacing retries and handling timezones, using your own call data.",
  "focusKeyword": "best time to call leads",
  "secondaryKeywords": ["best time to cold call", "calling hours for sales", "when to call leads"],
  "category": "Playbooks",
  "tags": ["timing", "retries", "campaigns"],
  "cover": "/images/blog/covers/best-time-to-call-leads.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is the best time to call leads?", "answer": "It depends on who the leads are. A reasonable starting point is the late morning and late afternoon on weekdays, avoiding the lunch hour and the first and last minutes of the working day. Your own answer rates will tell you more than any general chart."},
    {"question": "What is the best day to call leads?", "answer": "Many teams find midweek calls work well, but the difference between days is often smaller than the difference between a good and bad hour. Test in your own market rather than trusting a generic ranking."},
    {"question": "How do I handle leads in different timezones?", "answer": "Store or infer each lead's timezone and call within their local hours, not yours. If you cannot determine it, use a conservative window that is acceptable in every zone you might be dialing."},
    {"question": "How long after a lead enquires should I call?", "answer": "Sooner is generally better for people who asked to be contacted, ideally within minutes. See speed to lead for the reasoning and how an AI agent can do it automatically."},
    {"question": "Are there legal limits on calling hours?", "answer": "In many places, yes. Some rules restrict calls to certain hours in the recipient's local time. This is general information, not legal advice, so check the current rules for each country or state you call."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-07"
}
---
There is no single best time to call leads that works for everyone, and any article that claims one is generalising from somebody else's data. What does work is a method: pick sensible calling hours in the lead's own local time, vary your retry times so you do not keep hitting the same bad moment, and let your answer-rate data tell you what to adjust.

This article lays out that method with practical defaults, and shows how to configure hours and retries in an AI calling campaign. If your leads just enquired, timing is a different question, covered in [speed to lead](/blog/speed-to-lead-ai-calling).

## Why generic best-time charts mislead

Charts that rank hours of the day are usually built from a particular mix of industries, regions and call types. Your leads may behave differently for reasons the chart cannot know:

- **Who they are.** Business owners, shift workers, parents and retirees all have different free moments.
- **Why they are being called.** Someone who just filled out a form is attentive right now, whatever the hour. A cold call to a dormant list is a different thing.
- **Where they are.** A "good" hour in one timezone is the middle of the night in another.
- **How you measure.** A time that gets more answers is not always a time that gets more conversations you want.

Use general guidance as a starting hypothesis, not a conclusion.

## Sensible defaults to start with

For business-to-business calls to people at work, a common starting point is:

- **Late morning**, after the start-of-day rush and before lunch.
- **Late afternoon**, once the day's urgent items are done.
- **Avoid** the first and last half hour of the day, and the lunch hour, when people are most likely to be away or busy.

For consumer calls, such as home services or appointments, early evening on weekdays often reaches people when they are home, and weekend mornings can work, but the right choice depends on rules and on what the lead expects. Calling at unsocial hours is a fast way to lose a lead and, in many places, to breach rules.

These are starting points. The next step is testing.

## Handle timezones properly

Calling hours must be set against the lead's local time, not your own. If your list spans several zones:

1. **Capture or infer the timezone** for each contact, from the phone's area code, address or a field in your list.
2. **Set a window that is acceptable everywhere.** If you cannot tell, use a conservative one, such as mid-morning to late afternoon, local time.
3. **Split large campaigns by zone** so you are not calling the East Coast at lunchtime and the West Coast at breakfast by accident.

Area code is a weak signal, because people keep numbers when they move, so treat it as a fallback. For list hygiene, see the tips in [do not call lists and dialer hygiene](/blog/do-not-call-lists-and-dialer-hygiene).

### Legal calling hours

Many countries and states restrict the hours at which sales calls may be made, usually defined in the recipient's local time. The specifics differ and change. This is general information, not legal advice. Check the current rules for each place you call, and set your campaign hours inside them with room to spare. [Is AI cold calling legal](/blog/is-ai-cold-calling-legal) gives an overview.

## Retries: spread them out

Retries matter as much as the first attempt, because the first attempt often fails. The rule of thumb is to vary the hour and the day:

- If attempt one was late morning, make attempt two late afternoon.
- If a Tuesday attempt failed, try a different weekday next.
- Leave gaps. Three calls in one hour to a person who did not answer is not persistence, it is pressure.

An illustration for a warm lead in a retry schedule:

| Attempt | Timing |
|---|---|
| 1 | As soon as the lead arrives, within calling hours |
| 2 | Later the same day, different time block |
| 3 | Next day, morning |
| 4 | Two days later, afternoon |
| 5 | Final attempt, different weekday, then stop |

For a cold list, space attempts farther apart and use fewer. The full cadence discussion, including what to do about voicemail, is in [voicemail drop vs AI follow-up call](/blog/voicemail-drop-vs-ai-follow-up-call) and [follow-up cadence for new leads](/blog/follow-up-cadence-for-new-leads).

## How to set this up in Purple Voice

In a Purple Voice campaign you choose the calling hours, upload your list, and set how many retries the campaign should make, up to five, with retry hours that control when later attempts happen. The campaign shows a progress bar and not-reached analytics, so you can see how many contacts remain unanswered after the final try.

Practical tips:

- **Use retry hours that differ from your first window.** If the first pass runs mid-morning, give retries an afternoon slot.
- **Start with a small list.** The free plan covers 100 contacts per campaign, enough for a first test.
- **Confirm consent and permissions** before launching; the campaign setup includes a consent confirmation step for this reason.

## Find your own best time

The only reliable way to find your best time is to measure it. After a few campaigns, look at:

- **Answer rate by hour and day.** When are people picking up?
- **Conversation quality by hour.** Are the people who answer at 8am rushed and unqualified, while those at 4pm talk properly?
- **Booked or qualified rate by hour.** This is the number that matters. A time with many answers and few outcomes is not a good time.

Call data in the Calls section of the dashboard, with transcripts and summaries, makes this practical: you can read what happened on the calls that connected and see whether the time of day changed the tone. [AI calling metrics that matter](/blog/ai-calling-metrics-that-matter) explains which numbers to track and how to read them.

With small samples, be careful. A difference between two hours based on a handful of calls is noise. Gather a decent number of calls, change one variable at a time, and give each change enough runs to mean something.

## A short checklist before launch

- Hours are set in the lead's local time.
- Hours are inside the legal window for every place you call.
- Retries are spread across different hours and days.
- No more than five attempts per lead, with gaps.
- Lunchtime and the first and last minutes of the day are avoided where you can.
- You have a plan to review answer and booked rates by hour after the first batch.

## Try it

The easiest way to find your own best time is to run a small campaign with deliberately varied hours and read the results. Purple Voice has a Free plan, no card needed, with one campaign of up to 100 contacts. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
