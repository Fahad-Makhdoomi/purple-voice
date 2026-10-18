---
{
  "slug": "ai-calling-roi-calculator",
  "title": "AI calling ROI calculator: a formula you can run in a spreadsheet",
  "seoTitle": "AI calling ROI calculator: formula and worked example (2026)",
  "seoDescription": "Work out AI calling ROI with a simple formula and an illustrative worked example. Copy the inputs into a spreadsheet and see cost per booking and payback.",
  "excerpt": "A step-by-step AI calling ROI formula with inputs, a worked example table and sensitivity checks, so you can model your own numbers before you spend anything.",
  "focusKeyword": "ai calling roi calculator",
  "secondaryKeywords": ["ai voice agent roi", "ai calling cost per lead", "roi of ai cold calling"],
  "category": "Calculators",
  "tags": ["roi", "calculator", "costs"],
  "cover": "/images/resources/covers/ai-calling-roi-calculator.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "How do I calculate AI calling ROI?", "answer": "Subtract the total cost of the programme from the value of the extra meetings or sales it produces, then divide by the cost. Count platform fees, phone and AI provider usage, and your own review time."},
    {"question": "What inputs does an AI calling ROI calculator need?", "answer": "Number of contacts, answer rate, qualified rate, booked rate, show rate, close rate, average deal value and total costs. Use your own numbers where you have them and conservative guesses where you do not."},
    {"question": "What costs should I include?", "answer": "The platform plan, phone-number rental and call charges from your telephony provider, AI usage billed by the AI provider, and time spent reviewing calls and updating the agent. Leaving any out inflates the ROI."},
    {"question": "Is the worked example real data?", "answer": "No. The example is illustrative and uses round numbers to show the method. Replace every figure with your own."},
    {"question": "How long before AI calling pays back?", "answer": "It depends on your deal value, close rate and volume. High-value deals with a decent booked-to-close rate can pay back quickly, while low-value deals need more volume. Run a small pilot to measure it."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-27"
}
---
An AI calling ROI calculator does not need to be complicated. You need about eight inputs, five lines of arithmetic and the discipline to use your own numbers instead of optimistic ones. This page gives you the formula, a worked example with illustrative figures and the checks that stop you fooling yourself.

For the thinking behind it, see [AI voice agent ROI](/blog/ai-voice-agent-roi-calculator-guide). For a related measure, the [cost per booked meeting calculator](/resources/cost-per-booked-meeting-calculator) is a useful companion.

## The inputs

Collect these before you start. Use real data where you have it, and say "assumption" where you do not.

| Input | Symbol | Where it comes from |
|---|---|---|
| Contacts called | C | Your list size |
| Answer rate | A | Past campaigns, or a pilot |
| Qualified rate (of answered) | Q | Your definition of qualified |
| Booked rate (of qualified) | B | Calendar data |
| Show rate (of booked) | S | Calendar data |
| Close rate (of shows) | W | Sales records |
| Average deal value | V | Sales records |
| Total programme cost | T | See cost section below |

## The AI calling ROI formula

```
Answered      = C x A
Qualified     = Answered x Q
Booked        = Qualified x B
Showed        = Booked x S
Won           = Showed x W
Revenue       = Won x V
ROI           = (Revenue - T) / T
Cost per meeting = T / Booked
Cost per win     = T / Won
```

Use gross margin instead of revenue if you want a stricter test: replace V with the profit per deal.

## Worked example (illustrative)

These numbers are made up to show the method. Replace them.

| Step | Calculation | Result |
|---|---|---|
| Contacts called | | 1,000 |
| Answered | 1,000 x 30% | 300 |
| Qualified | 300 x 30% | 90 |
| Booked | 90 x 40% | 36 |
| Showed | 36 x 70% | about 25 |
| Won | 25 x 20% | 5 |
| Revenue | 5 x $2,000 | $10,000 |
| Total cost | see below | $1,500 |
| ROI | (10,000 - 1,500) / 1,500 | about 5.7x |
| Cost per booked meeting | 1,500 / 36 | about $42 |
| Cost per win | 1,500 / 5 | $300 |

An ROI of 5.7x here means every dollar spent returned about $5.70 in extra profit-before-other-costs. It says nothing about your business until you replace the inputs.

## What goes into total cost

Be generous when counting costs.

| Cost item | Notes |
|---|---|
| Platform plan | Purple Voice is Free, Basic at $19 a month, Pro at $299 a month, or Enterprise by quote |
| Phone number rental | Billed by your telephony provider, not Purple Voice |
| Call and AI usage | Billed by the providers for minutes and AI usage |
| List cost | Buying or cleaning contact data |
| Your time | Setup, test calls, transcript review, prompt changes |
| Human follow-up | Cost of the people who take the booked meetings |

In the example above, $1,500 might be made up of plan fees, provider usage, list costs and a few hours of review. The split is not important; including all of them is.

## Check your sensitivity

Change one input at a time and see how much the result moves.

| Scenario | Change | Effect on wins |
|---|---|---|
| Answer rate falls from 30% to 20% | Fewer conversations | Wins fall by a third |
| Booked rate rises from 40% to 50% | Better prompt and offer | Wins rise by a quarter |
| Close rate falls from 20% to 10% | Weaker meetings | Wins halve |

Usually the later steps, show rate and close rate, move the answer most. If your booked meetings do not turn into deals, a better dialler will not fix the ROI.

## Rules of thumb for honest modelling

- Use your lowest believable answer rate, not the best campaign you ever ran.
- Count only meetings that would not have happened anyway.
- Do not include the value of deals that were already in your pipeline.
- Include your own time at a realistic hourly rate.
- Re-run the sheet after the pilot with real numbers.

If you are planning a test, the [30-day pilot plan](/resources/ai-calling-pilot-plan-30-days) lays out how to collect them.

## Spreadsheet layout

Put inputs in one column (C through V), costs in another, and the funnel in a third that references them. Then add a small table of three scenarios (pessimistic, expected, optimistic) so you can see the range, not just one number.

## Try it

You can find your real inputs cheaply: run a small campaign on the Free plan, which includes one agent, one campaign of up to 100 contacts and 100 minutes a month, with no card. Insights and call summaries then give you answer, qualified and booked rates to drop into the sheet. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
