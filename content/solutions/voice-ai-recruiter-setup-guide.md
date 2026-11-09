---
{
  "slug": "voice-ai-recruiter-setup-guide",
  "title": "Set up an AI recruiter with Purple Voice: step by step from empty account to first call",
  "seoTitle": "Set up an AI recruiter | step-by-step with Purple Voice",
  "seoDescription": "How to set up an AI recruiter in Purple Voice: create the agent, add role knowledge, upload candidates, connect Google Calendar and test before you launch.",
  "excerpt": "A practical walk through the dashboard: agent, knowledge, phone number, campaign, calendar and test call, in the order that avoids rework.",
  "focusKeyword": "set up ai recruiter",
  "secondaryKeywords": ["ai recruiter setup", "configure ai recruiting agent", "ai phone screening setup", "voice agent campaign setup"],
  "category": "AI recruiter",
  "tags": ["ai-recruiter", "setup", "how-to"],
  "cover": "/images/solutions/covers/voice-ai-recruiter-setup-guide.webp",
  "schemaType": "HowTo",
  "faq": [
    {"question": "How long does it take to set up an AI recruiter?", "answer": "Many teams can have a test agent ringing their own phone within an hour, mostly spent writing the prompt and role notes. A live campaign takes longer because you should check the first calls and adjust."},
    {"question": "Do I need technical skills to set up an AI recruiter?", "answer": "No coding is needed for the basics. You write the prompt, add knowledge, upload a list and connect Google Calendar. Webhooks and API are for connecting other systems and need a Pro plan."},
    {"question": "What do I need before I start?", "answer": "A phone number from a supported provider such as Twilio, Plivo or SuperPhone, a candidate list you have permission to contact, role details and a Google Calendar for interviews."},
    {"question": "Who manages the AI models?", "answer": "The Purple Voice team manages the AI layer for each customer. You focus on the prompt, voice and knowledge, while AI and phone usage are billed by their providers."},
    {"question": "Can I try it before paying?", "answer": "Yes. The free plan includes one agent, one number, one campaign, 100 contacts and 100 minutes a month, with no card."}
  ],
  "howToSteps": [
    {"name": "Create the agent", "text": "Open Agents, create a new agent and write the prompt, voice and opening line."},
    {"name": "Add role knowledge", "text": "Load pay, hours, location and process into the knowledge base."},
    {"name": "Connect number and calendar", "text": "Link your phone number and connect Google Calendar under Integrations."},
    {"name": "Test, then launch", "text": "Use the test call on your phone, then upload a small list and start the campaign."}
  ],
  "publishedAt": "2026-11-02"
}
---
To set up an AI recruiter in Purple Voice you create an agent, give it role knowledge, connect a phone number and Google Calendar, test it on your own phone and then launch a small campaign. This guide follows the dashboard in the order that avoids rework, and is written for recruiters and hiring managers who want to be running calls the same day.

Not sure what this will do for you? Read the [voice AI recruiter overview](/solutions/voice-ai-recruiter) first.

## What the setup involves

- **Agent prompt and voice.** Who it represents, the questions in order, the tone and the voice you choose.
- **Knowledge base.** Pay, hours, location, process and the answers to the queries candidates always ask.
- **Phone number.** Your own number from Twilio, Plivo or SuperPhone.
- **Campaign.** The candidate list, calling hours, retries up to 5 and retry hours, plus consent confirmation.
- **Google Calendar.** Booking interviews against real availability.
- **Outputs.** Transcripts, AI summaries and recordings in Calls, bookings in Appointments.
- **Optional automation.** Webhooks and API keys in Developers on the Pro plan, covered in the [ATS workflow guide](/solutions/voice-ai-recruiter-ats-workflow).

## Setup map

| Dashboard area | What you do there | Check before moving on |
|---|---|---|
| Agents | Write prompt, pick voice, add knowledge | Test call sounds right |
| Phone numbers | Connect the number the agent will use | Caller ID is one candidates can recognise |
| Integrations | Connect Google Calendar | A test booking appears |
| Campaigns | Upload list, set hours and retries | Consent is confirmed for each contact |
| Calls | Review transcripts and summaries | The agent follows the script |
| Appointments | See booked interviews | Times match your availability |

## A sample test call

*Illustrative only.*

**Agent:** Hello, this is an AI assistant calling for a company about the sales coordinator role. Is now a good time?
**You (testing):** Go on.
**Agent:** Do you have experience with scheduling or admin?
**You (testing):** Yes, three years.
**Agent:** Great. Are you available for a short call with the recruiter on Friday?
**You (testing):** Can you tell me the pay first?
**Agent:** The posted range is in the notes I have. I can pass that to the recruiter or share it now.

If the agent invents a figure you did not provide, fix the knowledge base and prompt before launching.

## What to set up first

1. Create your account on the free plan and open Agents.
2. Write the prompt: identity, disclosure, the order of questions, what the agent may and may not say.
3. Add the knowledge base with real role details and a line telling it what to do when it does not know.
4. Connect a phone number under Phone numbers, using a number you own and that candidates can call back.
5. Connect Google Calendar under Integrations and make sure the right calendar is used.
6. Ring your own phone with the test call, interrupt, stay silent, ask about pay and note anything that goes wrong.
7. Create a campaign, upload a short list, set calling hours, retries up to 5 and retry hours, and confirm consent.
8. Watch the first batch in Calls and adjust the prompt before scaling.

## How to set up an ai recruiter without common mistakes

The usual errors are too many questions, vague role notes and launching to a full list on day one. Keep the first campaign small, stay close to the first calls and correct problems early. For a script to start from, see the [call script guide](/solutions/voice-ai-recruiter-call-script). For compliance basics, see the [sales call compliance checklist](/resources/sales-call-compliance-checklist).

## Where it falls short

Setup does not guarantee good calls. A weak prompt makes a weak agent, and poor line quality or unclear speech can still cause misheard answers. The free plan limits you to 100 contacts and one campaign, so larger runs need a paid plan. Webhooks and API access are on Pro. You remain responsible for consent and for the fairness of your process; check current rules where you hire.

## Try it

Start on the free plan at [voice.purplerocket.co](https://voice.purplerocket.co), no card needed. Compare plans on [pricing](/pricing), then see the [launch checklist](/resources/ai-voice-agent-launch-checklist) before you go live.
