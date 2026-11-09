---
{
  "slug": "voice-ai-recruiter-ats-workflow",
  "title": "AI recruiter ATS workflow: moving call results into your tracking system",
  "seoTitle": "AI recruiter ATS workflow | webhooks and API for call data",
  "seoDescription": "Build an AI recruiter ATS workflow: use Purple Voice webhooks and API keys to send call outcomes, summaries and bookings to the system you already use.",
  "excerpt": "How call results can flow from a voice agent into your applicant tracking system with webhooks and the API, and what to decide before you build it.",
  "focusKeyword": "ai recruiter ats workflow",
  "secondaryKeywords": ["ats integration voice ai", "webhook candidate call data", "ai screening results ats", "recruiting automation api"],
  "category": "AI recruiter",
  "tags": ["ai-recruiter", "ats", "webhooks"],
  "cover": "/images/solutions/covers/voice-ai-recruiter-ats-workflow.webp",
  "schemaType": "TechArticle",
  "faq": [
    {"question": "Does Purple Voice integrate with my ATS?", "answer": "There is no pre-built ATS connector described here. On the Pro plan you can use webhooks, API keys and automations in the Developers section to send call data to your system, which usually needs a developer or a workflow tool."},
    {"question": "What call data can I send to an ATS?", "answer": "Typically the call outcome, the AI summary, the transcript, appointment details and any fields you structure in your prompt. Confirm the exact payload in the Developers section."},
    {"question": "Which plan includes webhooks and API access?", "answer": "Webhooks, API keys and advanced automations are on the Pro plan, at $299 a month with 20,000 minutes. Enterprise is custom."},
    {"question": "Can I start without any integration?", "answer": "Yes. Start with transcripts, summaries and appointments in the dashboard, and add the ATS link once the script is stable."},
    {"question": "Is it safe to send candidate data to my ATS?", "answer": "It can be, but treat candidate data as personal data. Limit what you send, secure endpoints and keys, and check data protection obligations where you hire."}
  ],
  "howToSteps": [
    {"name": "Choose fields to move", "text": "Decide which outcomes and notes your ATS needs, such as status, summary and interview time."},
    {"name": "Create webhook and key", "text": "In Developers, create a webhook endpoint and an API key on a Pro plan."},
    {"name": "Map to ATS records", "text": "Match each call to a candidate record by phone number or an ID you pass in."},
    {"name": "Test with sample calls", "text": "Run a few test calls, check the records update correctly, then scale up."}
  ],
  "publishedAt": "2026-11-08"
}
---
An AI recruiter ATS workflow sends the results of each call, such as the outcome, summary and booked interview, into the applicant tracking system where your team already works. In Purple Voice that is done through webhooks, API keys and automations in the Developers section, available on the Pro plan. This page is for recruiting operations people and developers who want screening data in one place instead of copied by hand.

Background on the agent is in the [voice AI recruiter overview](/solutions/voice-ai-recruiter).

## What the workflow can do

- **Update candidate status.** Mark someone as screened, not reached or interested, based on the call outcome.
- **Attach the summary.** Put the AI summary on the candidate record so a recruiter sees it before ringing.
- **Store the transcript.** Keep the full conversation for review, subject to your data policy.
- **Record the interview slot.** Pass the booked time from Appointments to the right record.
- **Trigger a next step.** Notify a recruiter when a candidate asks for a human or is worth a transfer.
- **Feed reporting.** Count contacts, completions and bookings by role in your own reports.

## Flow from call to record

| Stage | What happens | Where |
|---|---|---|
| Campaign | Agent calls candidates from your list | Campaigns |
| Call ends | Transcript and summary are produced | Calls |
| Event fires | A webhook sends the outcome to your endpoint | Developers |
| Your system | Receives data, finds the candidate, updates the record | Your ATS or workflow tool |
| Recruiter | Sees status, summary and interview time | Your ATS |

## A sample payload story

*Illustrative only, not a literal payload.*

A candidate finishes a call. The outcome is "completed", the summary says she can start in two weeks and asked about travel pay, and an interview is booked for Thursday. Your endpoint receives that event, looks up her record by the phone number you uploaded, sets status to "phone screened", saves the summary as a note and creates an interview entry. The recruiter opens the ATS, sees the note and calls with the travel pay answer ready.

Check the Developers section for the actual event names and fields before building.

## What to set up first

1. Decide what must reach the ATS and what can stay in the dashboard. Fewer fields means fewer errors.
2. Use a stable identifier. Upload candidate IDs or use the phone number consistently so you can match calls to records.
3. Create a webhook endpoint in your system, or in a workflow tool, that can receive and log requests.
4. Generate an API key in Developers and store it securely, never in shared documents.
5. Run a few test calls and confirm the records update correctly, including no-answer and opt-out outcomes.
6. Handle duplicates and retries, so one candidate does not get two records or two statuses.
7. Keep the Calls dashboard as your source of truth while you test.

## Building an ai recruiter ats workflow that holds up

Failures usually come from mismatched identifiers, missing consent flags and endpoints that go down. Log everything the first week, make your endpoint return quickly and retry safely. Data protection applies: send only what the ATS needs, restrict access to transcripts and delete data according to your retention policy. For the compliance basics, read the [sales call compliance checklist](/resources/sales-call-compliance-checklist). If you do not yet know what to measure, see [recruiter metrics](/solutions/voice-ai-recruiter-metrics), and for plan limits see the [cost guide](/solutions/voice-ai-recruiter-cost).

## Where it falls short

There is no one-click ATS connector described on this page, so someone must build and maintain the link. Webhooks and API access are on Pro, which may not suit a team running a single small pilot. Transcripts can contain sensitive details candidates volunteered, so decide what gets stored. If the ATS goes down or the mapping is wrong, records can lag or mismatch, which is why the dashboard stays your backup. This is general information, not legal advice.

## Try it

Prove the script first on the free plan, with summaries and booking, no card and 100 minutes a month, at [voice.purplerocket.co](https://voice.purplerocket.co). When the process is stable, see [pricing](/pricing) for Pro and the [setup guide](/solutions/voice-ai-recruiter-setup-guide).
