---
{
  "slug": "ai-lead-qualification-calls",
  "title": "AI lead qualification: questions to ask and how to score from transcripts",
  "seoTitle": "AI lead qualification: questions, scoring and transcripts",
  "seoDescription": "AI lead qualification playbook: which questions an AI voice agent should ask, how to define a qualified lead, and how to score calls from transcripts.",
  "excerpt": "A practical playbook for qualifying leads by phone with an AI agent: pick four questions, define what 'qualified' means and review transcripts to keep the scoring honest.",
  "focusKeyword": "ai lead qualification",
  "secondaryKeywords": ["qualify leads with ai", "lead qualification calls", "lead scoring from call transcripts"],
  "category": "Playbooks",
  "tags": ["qualification", "lead-scoring", "transcripts"],
  "cover": "/images/blog/covers/ai-lead-qualification-calls.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is AI lead qualification?", "answer": "It is using a voice agent to ask a lead a short set of questions on a call, record the answers and decide whether they should be passed to sales, nurtured or closed."},
    {"question": "What questions should an AI agent ask to qualify a lead?", "answer": "Keep it to three or five questions about need, timeline, authority and budget or scope, phrased naturally. Ask only what changes the next step."},
    {"question": "How do you score a lead from a call transcript?", "answer": "Define what qualifies in advance, for example a confirmed need, a timeline within three months and the right decision-maker, then tag each call against those criteria and sort into hot, warm and not now."},
    {"question": "Can an AI agent judge lead quality as well as a person?", "answer": "It can apply criteria consistently, but a person should review borderline calls and periodically audit the scoring. It is only as good as the definition of qualified you give it."},
    {"question": "How many qualification questions are too many?", "answer": "More than five on a first call tends to feel like a form, and people drop off. Ask what you need to route the lead and leave deeper discovery for the human call."},
    {"question": "Should the AI agent book meetings with unqualified leads?", "answer": "Generally no. Wasted meetings cost more than a missed borderline lead. Give the agent clear criteria and a polite way to close the call or route to nurture when criteria are not met."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-01"
}
---
AI lead qualification works when you decide, before the agent makes a single call, what a qualified lead is and which three to five questions reveal it. The agent then asks those questions in a conversational way, records the answers, and routes each lead: pass to a person, nurture or close. Without that definition, an agent just produces more transcripts.

This playbook covers how to pick questions, how to define qualified, how to score from transcripts and how to keep the scoring honest.

## Start with the decision, not the questions

Qualification exists to decide what happens next. Before writing questions, list the possible outcomes:

- **Hot:** book a meeting or transfer to a person now.
- **Warm:** follow up later, with a specific trigger or date.
- **Not now:** nurture with low-effort contact.
- **Not a fit:** close politely and stop calling.

Then ask: what information separates these outcomes? Only those facts are worth asking about on a first call.

## Choose three to five questions

Frameworks like BANT (budget, authority, need, timeline) and others are useful as checklists, but most first calls only need a subset. A practical starting set:

1. **Need.** "What are you hoping to sort out?" It confirms the enquiry and reveals urgency.
2. **Timeline.** "When are you looking to get this done?" Distinguishes this month from someday.
3. **Authority.** "Are you the person who decides on this, or is anyone else involved?"
4. **Scope or budget range.** "Roughly what size of job or budget are you considering?" Phrase it as a range, not a demand.
5. **Fit check.** One question specific to your business, such as location, company size or existing solution.

More question ideas, grouped by framework, are in the [lead qualification questions bank](/resources/lead-qualification-questions-bank).

### Phrase questions like a person

| Form-like | Conversational |
| --- | --- |
| "What is your budget?" | "Have you got a rough budget in mind, or are you still working that out?" |
| "Who is the decision maker?" | "Will anyone else be involved in the decision?" |
| "What is your timeline?" | "Is this something you need soon, or are you planning ahead?" |
| "State your company size." | "Roughly how big is the team?" |

Conversational wording gets better answers and fewer hang-ups. It also lets the agent follow up if an answer is vague.

## Define what qualified means

Write it as a short, testable rule. For example, for a home-improvement company (illustrative):

- **Hot:** project confirmed, within 8 weeks, owns the property, in service area.
- **Warm:** project confirmed, 2 to 6 months out, owns property, in service area.
- **Not now:** just researching, no timeline.
- **Not a fit:** outside service area or rents.

Notice that each category is built from the answers to the questions you asked. If a rule needs information the agent does not collect, either add a question or drop the rule.

Put this definition in the agent's instructions so it knows when to offer a booking and when to wrap up politely. For instruction structure, see [how to write an AI voice agent prompt](/blog/how-to-write-an-ai-voice-agent-prompt).

## Scoring from transcripts

Each call produces a transcript and a summary. You can score in two ways.

### 1. Outcome tagging

Each call ends with a status: booked, transferred, qualified but not booked, not interested, not a fit, no answer. This is the simplest and most useful signal.

### 2. Criteria checklist

For each qualified or borderline call, check the criteria:

| Criterion | Yes / No / Unknown |
| --- | --- |
| Need confirmed | |
| Timeline within target | |
| Right person | |
| In scope or budget range | |
| Agreed next step | |

Count the yeses to get a simple score, and note unknowns separately. Unknown is information: it shows which question was skipped or not answered.

A spreadsheet is enough to start. If you use webhooks on the Pro plan, the outcome can be pushed to your CRM along with the summary. See [AI call summaries and CRM notes](/blog/ai-call-summaries-and-crm-notes).

## Keep the scoring honest

Automated scoring drifts unless you check it.

- **Read a sample every week.** Pick ten calls, including a few the agent rated hot and a few it rated not a fit.
- **Look for false positives.** Leads marked hot that the human closer found unqualified.
- **Look for false negatives.** Leads marked not a fit who later bought elsewhere or called back.
- **Ask your closers.** Their view of lead quality is the best check.
- **Adjust the definition, not just the agent.** If hot leads keep turning out cold, the rule is probably too loose.

## Common pitfalls

- **Interrogation tone.** Five questions in a row feel like a form. Mix in acknowledgements and explain why you ask.
- **Asking what you will not use.** Every question needs a reason.
- **Treating "unknown" as "no".** A lead who did not answer about budget is not unqualified.
- **Pushing for a booking regardless.** If criteria are not met, the right outcome is not a meeting.
- **Sensitive questions.** Avoid collecting data you do not need, and be careful with health, financial or personal details.

## Handling vague or evasive answers

Give the agent a rule for these: ask once more, in different words, then move on and mark the answer as unknown. For example:

> Agent: "Do you have a rough timeframe?"
> Caller: "Not sure yet."
> Agent: "That's fine. Is it more a this-year thing, or just looking around?"
> Caller: "Just looking around."

The agent logged a clear answer: researching, no timeline.

## From qualified to booked

Once a lead meets the criteria, the agent should move directly to the next step: either a booking or a transfer. Qualified leads that wait for a follow-up call cool quickly. See [AI appointment setting](/blog/ai-appointment-setting) and [speed to lead](/blog/speed-to-lead-ai-calling).

## A worked example of one call

Here is a short, illustrative call summary for a lead the agent rated warm.

- **Need:** replace an ageing boiler, confirmed.
- **Timeline:** "before winter", roughly three months.
- **Authority:** owns the home, partner will join the decision.
- **Scope:** wants a quote, no budget stated.
- **Outcome:** warm. Agreed a follow-up call in two weeks, partner to be present.

The agent did not force a meeting. It logged what it learned, noted the unknown budget, and set a specific next step. A human reading that summary knows exactly where to pick up, which is the real purpose of qualification.

## A note on fairness and compliance

Qualification criteria should be relevant to the offer and applied consistently. Avoid criteria that would unfairly screen out people on protected grounds. Rules on automated calls and data handling vary by country. This is general information, not legal advice, so check current requirements.

## Try it

Write your hot, warm and not-fit rules in plain English, turn them into four questions, and test them by calling yourself as three different kinds of lead. Purple Voice's Free plan covers one agent, one number and 100 minutes a month, with summaries and booking included, and needs no card. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
