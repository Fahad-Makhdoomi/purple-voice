---
{
  "slug": "ai-calling-metrics-that-matter",
  "title": "AI calling metrics that matter: answer, qualified and booked rates",
  "seoTitle": "AI calling metrics that matter: what to track and why",
  "seoDescription": "The AI calling metrics worth tracking: answer rate, conversation rate, qualified rate, booked rate and cost per booking, with formulas and how to read them.",
  "excerpt": "Which AI calling metrics are worth your attention, how to calculate them, and how to read them together so you fix the right stage of the funnel.",
  "focusKeyword": "ai calling metrics",
  "secondaryKeywords": ["ai call analytics", "outbound calling kpis", "answer rate qualified rate booked rate"],
  "category": "Guides",
  "tags": ["metrics", "analytics", "insights"],
  "cover": "/images/blog/covers/ai-calling-metrics-that-matter.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What are the most important AI calling metrics?", "answer": "Answer rate, conversation rate, qualified rate, booked rate and cost per booked meeting. Read together they show where leads drop out of the funnel, which tells you what to fix."},
    {"question": "What is a good answer rate for outbound calls?", "answer": "It varies widely by audience, time of day, number reputation and list quality, so published benchmarks are unreliable. Track your own rate over time and compare changes against your baseline."},
    {"question": "How do I calculate booked rate?", "answer": "Divide the number of meetings booked by the number of conversations, or by the number of contacts, and say which one you used. Using conversations tells you how good the call is; using contacts tells you how good the campaign is."},
    {"question": "Where can I see AI calling metrics in Purple Voice?", "answer": "Campaign progress and not-reached analytics sit within Campaigns, and the Insights area shows analytics across calls. Insights is included on the Pro plan."},
    {"question": "Why are transcripts important alongside metrics?", "answer": "Metrics tell you that something changed; transcripts tell you why. When a rate drops, read the calls from that period to find the cause."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-12"
}
---
The AI calling metrics that matter most are the ones that follow a lead through the funnel: how many answered, how many had a real conversation, how many were qualified and how many booked. Read in that order, they show you which stage is leaking and what to fix first.

Dashboards offer plenty of numbers. Most are interesting; few change what you do on Monday. This guide picks the handful that do, shows how to calculate them and warns about the common ways of misreading them.

## Think in a funnel

An outbound campaign is a funnel:

1. **Contacts dialled**
2. **Calls answered**
3. **Real conversations**
4. **Qualified leads**
5. **Booked meetings** (or whatever your goal is)

Each stage has a rate, and each rate points at a different cause. A low answer rate is a timing or number problem. A low qualified rate is a list or script problem. Fixing the wrong stage wastes weeks.

## The metrics, with formulas

| Metric | Formula | What it tells you |
|---|---|---|
| Answer rate | Answered calls ÷ calls placed | Timing, number reputation, list quality |
| Conversation rate | Conversations ÷ answered calls | Opening strength; whether people stay on |
| Qualified rate | Qualified leads ÷ conversations | Fit between the list, the offer and the questions |
| Booked rate | Meetings booked ÷ qualified leads | Booking logic, offer, handover |
| Show rate | Meetings attended ÷ meetings booked | Quality of the booking and confirmation |
| Cost per booked meeting | Total spend ÷ meetings booked | Whether the whole thing pays |

Define "conversation" before you start. A common choice is a call that lasted more than a set number of seconds with the lead actually responding. Whatever you pick, keep it fixed, or the trend line lies.

### Answer rate

Answer rate is mostly about when and from where you call. It changes with hours, retries and your number's standing with carriers. Compare windows against each other: if evening calls connect better than mid-afternoon ones, shift your calling hours. [Best time to call leads](/blog/best-time-to-call-leads) covers how to test this.

Be careful with benchmarks. Published answer rates vary enormously by market and list type, so your own history is the only comparison that means anything.

### Conversation rate

Of the people who picked up, how many stayed long enough to talk? A weak number here is nearly always the opening: the first ten seconds. Read the short calls. See [cold call opening lines](/blog/cold-call-opening-lines) for what tends to hold attention.

### Qualified rate

This is the metric most affected by the list. If you are calling the wrong people, no prompt will rescue it. If the list is right but the qualified rate is low, the questions may be clumsy or the criteria too tight. Define "qualified" in writing before the campaign, in plain terms the agent can apply, and review borderline calls by hand. [AI lead qualification calls](/blog/ai-lead-qualification-calls) has question ideas.

### Booked rate

Of the qualified leads, how many agreed a time? A low rate here points at booking behaviour: too few slot options, a calendar with no availability, or an agent that never actually asks. Check the calendar integration works properly; [Google Calendar booking with an AI agent](/blog/google-calendar-booking-with-ai-agent) covers the setup.

### Show rate and cost per booking

The last two are the ones the business actually feels. A high booked rate with a low show rate means you are creating meetings that evaporate. Cost per booked meeting adds provider charges, platform fees and your own time. For worked illustrations, see [AI voice agent ROI](/blog/ai-voice-agent-roi-calculator-guide).

## Illustrative reading of a funnel

These numbers are invented to show the method, not to suggest targets.

| Stage | Count |
|---|---|
| Contacts dialled | 100 |
| Answered | 40 |
| Conversations | 30 |
| Qualified | 12 |
| Booked | 6 |

Answer rate: 40 percent. Conversation rate: 75 percent. Qualified rate: 40 percent. Booked rate: 50 percent.

Which stage looks weakest? Without benchmarks you cannot say in the abstract, but you can say which one to test. Perhaps the booked rate: half of qualified leads not booking is a gap you can inspect directly by reading the twelve qualified transcripts. That is more useful than staring at the total.

## Where to see them in Purple Voice

Campaign progress shows how much of a list has been worked, and the not-reached analytics show who has not been connected, which feeds answer-rate decisions. The **Insights** area gives you a broader view across calls. Insights is part of the Pro plan; on smaller plans you can still count from campaign and call data.

![Insights page showing call analytics in Purple Voice](/images/blog/screens/insights.webp)

*The Insights page summarises call analytics so you can see trends instead of single calls.*

## Pair numbers with transcripts

Metrics tell you that a rate moved; transcripts tell you why. When a number drops, open the calls from that window and read a dozen. Maybe the opening changed, maybe the list contained a new source, maybe a knowledge-base item went stale. The routine in [improve your AI agent with call transcripts](/blog/improve-ai-agent-with-call-transcripts) puts this into practice.

## Mistakes to avoid

- **Judging on too few calls.** A rate from twenty calls is a rumour. Wait for enough volume before you act.
- **Changing several things at once.** You will never know what moved the number.
- **Mixing denominators.** "Booked rate" per contact and per conversation are different metrics; label them.
- **Chasing the wrong goal.** Maximising calls answered or call length is easy and pointless. Optimise toward meetings that happen.
- **Ignoring complaints.** A good conversion rate that comes with angry leads is a cost, not a win. Track opt-out requests too.

## A simple weekly dashboard

If you track nothing else, track these five numbers every week, in the same order:

1. Calls placed and answer rate
2. Conversation rate
3. Qualified rate
4. Booked rate and show rate
5. Cost per booked meeting

Add a note column for what you changed that week.

## Segment before you conclude

An overall rate can hide the real story. Split your numbers by list source, by calling window, by agent version and by day of the week before you decide anything. A campaign with a mediocre blended booked rate may contain one list that performs well and one that drags it down. The fix in that case is not a new prompt; it is dropping or reworking the weak list. Segmenting costs a few minutes in a spreadsheet and often saves weeks of misdirected tuning.

## Try it

The Free plan lets you run an agent and one campaign with booking and summaries, 100 minutes a month, no card. Start at [voice.purplerocket.co](https://voice.purplerocket.co), run a small campaign and count the funnel yourself. Insights and other analytics features are on Pro; see the [pricing page](/pricing).
