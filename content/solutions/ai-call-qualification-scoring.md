---
{
  "slug": "ai-call-qualification-scoring",
  "title": "AI lead scoring from calls: build a scorecard and set thresholds",
  "seoTitle": "AI lead scoring from calls | scorecards and thresholds",
  "seoDescription": "AI lead scoring from calls turns spoken answers into a score your team can sort and act on. Build a scorecard, set thresholds and keep a human in the loop.",
  "excerpt": "How to turn what a lead says on a call into a transparent score, pick thresholds for booking, review and drop, and keep the scoring honest.",
  "focusKeyword": "ai lead scoring from calls",
  "secondaryKeywords": ["lead scoring from phone calls", "call scorecard for lead qualification", "score leads with ai voice agent", "qualification thresholds"],
  "category": "Call qualification",
  "tags": ["call-qualification", "lead-scoring", "scorecard"],
  "cover": "/images/solutions/covers/ai-call-qualification-scoring.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "How does AI lead scoring from calls work?", "answer": "The agent asks fixed questions, and each answer maps to points on a scorecard you define. The total decides whether the lead is booked, reviewed by a person or closed out."},
    {"question": "What is a good lead score threshold?", "answer": "There is no universal number. Set it by looking at past deals: pick the score above which most of your closed deals would have landed, then adjust after a few weeks of results."},
    {"question": "Should the AI decide the score or should a human?", "answer": "The agent applies the scorecard consistently, but a person should own the scorecard and review leads near the threshold. That keeps one bad rule from quietly dropping good leads."},
    {"question": "How many criteria should a lead scorecard have?", "answer": "Five to eight is a workable range. More than that and nobody can explain why a lead scored as it did."},
    {"question": "Can lead scores be explained to the sales team?", "answer": "They can if the scorecard is simple and the summary lists each answer with its points. Avoid scores that no one can trace back to what the lead said."}
  ],
  "howToSteps": [
    {"name": "Pick scoring factors", "text": "Choose five to eight answers that separate your best customers from poor fits."},
    {"name": "Assign points", "text": "Give each answer a weight, with knockout answers set to rule the lead out."},
    {"name": "Set thresholds", "text": "Define the scores that book, flag for review or close out a lead."},
    {"name": "Review and recalibrate", "text": "Compare scores with real outcomes every few weeks and adjust the weights."}
  ],
  "publishedAt": "2026-10-25"
}
---
AI lead scoring from calls turns a voice agent's conversation into a number your team can sort by: each answer a lead gives earns points on a scorecard, and the total decides who gets a call back first. It suits sales teams with more leads than hours. A score only helps if people can see why it came out as it did, so this page is about keeping the scorecard simple and checkable. The wider context is in [AI call qualification](/solutions/ai-call-qualification).

## What an AI voice agent does for lead scoring

- **Collects the inputs.** The agent asks the same questions every time, so scores compare fairly across leads.
- **Maps answers to points.** "Ready within a month" scores high, "just browsing" scores low, according to your table.
- **Applies knockouts.** Some answers, such as outside your service area, end the call and score zero regardless of anything else.
- **Records the reasoning.** The summary lists the answers and the points each earned.
- **Routes by threshold.** High scores are transferred or booked, middle scores wait for review, low scores are logged.
- **Keeps the transcript.** If a score looks wrong, someone can read what was actually said.

## Building the scorecard

Start from outcomes, not theory. Look at recent closed-won and closed-lost leads and note which answers differed. Then write a table like this one.

| Factor | Answer | Points |
| --- | --- | --- |
| Timing | Within 1 month | 30 |
| Timing | 1-3 months | 20 |
| Timing | Later or unknown | 5 |
| Need | Clear problem we solve | 25 |
| Need | Vague interest | 8 |
| Decision | Decides alone or with one other | 20 |
| Decision | Someone else decides | 8 |
| Size | At or above minimum | 15 |
| Size | Below minimum | 0 |

*Illustrative weights only; use your own history.*

Keep the maximum at 100 so people can read it at a glance. Give each factor a weight proportional to how strongly it has predicted a deal for you. If you cannot defend a weight, remove the factor.

## Setting thresholds for book, review and drop

A single cut-off hides too much. Use three zones:

- **70 and above:** book or warm transfer immediately.
- **40 to 69:** send to human review with the summary within a set time.
- **Below 40:** log and thank the lead; add to a nurture list if appropriate.

Choose the numbers by testing them against the last 30 leads. If the review zone is too crowded, narrow it. If too many strong leads land in the drop zone, lower the bottom line. The right number is whatever your team can follow up inside the window that matters; see [speed to lead with AI calling](/blog/speed-to-lead-ai-calling).

## A sample call

*Illustrative only.*

**Agent:** You asked about a loft conversion quote. Can I ask a few questions so the right builder calls you?
**Caller:** Yes.
**Agent:** Do you own the house?
**Caller:** Yes.
**Agent:** When would you like the work to start?
**Caller:** We're hoping this autumn.
**Agent:** Is there a rough budget you've set?
**Caller:** Around forty thousand.
**Agent:** Thanks. That sounds like a good fit for our surveyor, who can visit this week. Would Friday suit?

In the summary, this lead would show ownership confirmed, timing within three months, budget above minimum and a score in the booking zone.

## What to set up first

1. Choose five to eight scoring factors and write the points table.
2. Mark any knockout answers and what the agent says when they appear.
3. Put the questions and the knockout rules in the agent prompt, and ask for a summary that lists each answer.
4. Set the three thresholds and decide who reviews the middle zone and by when.
5. Connect Google Calendar and warm transfer for the top zone.
6. Run campaign hours and retries so scores come from enough contacted leads.
7. Test-call your own phone with answers that should land in each zone.

## Where scoring falls short

- A score looks more precise than it is. Spoken answers are approximate, and a 68 is not meaningfully different from a 72.
- Weights drift. Markets, offers and ideal customers change, so recalibrate against actual results.
- The agent cannot verify claims. Someone describing a large budget simply gets the points.
- Scoring answers cannot capture gut feel from a seasoned rep. Keep the review zone so that judgement still counts.
- Over-complex scorecards are impossible to audit. When in doubt, remove a factor.

Questions that feed the scorecard are covered in [AI call qualification questions](/solutions/ai-call-qualification-questions), and the routing step in [MQL to SQL handoff](/solutions/ai-call-qualification-handoff-to-sales). For a ready-made set of prompts, see the [lead qualification questions bank](/resources/lead-qualification-questions-bank).

## Keeping the scorecard honest over time

A scorecard written once will drift. Set a monthly review: take the last 30 scored leads, check which converted, and see whether high scores really did better than low ones. If a factor shows no relationship with outcomes, reduce its weight or remove it. If reps keep overriding scores in the same direction, find out why, because they may be using information the agent does not collect. Record each change and the date, so you can tell whether a shift in results came from the scorecard or from your market. Simple and reviewed beats clever and ignored.

## Try it

Build a scorecard on paper first, then give it to an agent. The Free plan includes 100 minutes a month with summaries and no card, at [voice.purplerocket.co](https://voice.purplerocket.co). Pro adds insights and webhooks for sending scores to your CRM; see the [pricing page](/pricing).
