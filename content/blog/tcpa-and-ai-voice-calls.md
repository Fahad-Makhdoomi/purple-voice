---
{
  "slug": "tcpa-and-ai-voice-calls",
  "title": "TCPA and AI voice calls: what US sales teams need to know",
  "seoTitle": "TCPA and AI voice calls: consent rules for AI agents (2026)",
  "seoDescription": "How the TCPA treats AI voice calls: artificial voice, prior express written consent, revocation and records. A plain guide for US sales teams (not legal advice).",
  "excerpt": "The FCC treats AI-generated voices as artificial voices under the TCPA. Here is what that means for consent, lists and records when you call leads with an AI agent.",
  "focusKeyword": "tcpa ai voice calls",
  "secondaryKeywords": ["tcpa artificial voice", "ai robocalls fcc", "tcpa prior express written consent"],
  "category": "Compliance",
  "tags": ["compliance", "tcpa", "united-states"],
  "cover": "/images/blog/covers/tcpa-and-ai-voice-calls.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "Does the TCPA apply to AI voice calls?", "answer": "Yes. In a 2024 declaratory ruling the FCC said that AI-generated voices count as an artificial or prerecorded voice under the TCPA. That brings AI calling under the same consent requirements as other prerecorded calls."},
    {"question": "What kind of consent do I need for AI sales calls?", "answer": "For marketing or telemarketing calls using an artificial voice, the TCPA generally requires prior express written consent. That means a signed agreement, which can be electronic, that clearly authorises the calls to that number."},
    {"question": "Can a person stop AI calls once they have agreed?", "answer": "Generally yes. Consent can be revoked, and the FCC has tightened the rules on how revocation must be honoured. Build opt-out handling into the agent and your systems, and check the current timelines."},
    {"question": "Do the TCPA rules apply to B2B calls?", "answer": "Parts of the TCPA apply no matter who you call, for example the rules on artificial voices to mobile phones. Some protections, like the Do Not Call Registry, focus on residential numbers. Do not assume a business call is exempt."},
    {"question": "What are the penalties for TCPA violations?", "answer": "Statutory damages are commonly cited as $500 per violation, and up to three times that for wilful or knowing violations. Class actions can multiply these numbers quickly, which is why record keeping matters."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-11"
}
---
If you call US leads with an AI agent, the Telephone Consumer Protection Act (TCPA) is the law to understand first. The FCC has said that AI-generated voices count as an "artificial or prerecorded voice", so TCPA AI voice calls generally need the consent that prerecorded calls need. For marketing calls, that usually means prior express written consent.

This is general information, not legal advice. The TCPA is litigated heavily, FCC rules change, and state laws add more layers. Check current requirements and speak to a qualified lawyer before you launch.

## Why the TCPA matters more for AI than for human callers

The TCPA, passed in 1991 and enforced by the FCC with a private right of action, restricts several things:

- Calls using an automatic telephone dialling system (autodialler) or an artificial or prerecorded voice to mobile phones without consent.
- Prerecorded telemarketing calls to residential landlines without consent.
- Telemarketing calls to numbers on the National Do Not Call Registry, subject to exemptions.
- Calls outside permitted hours, generally 8am to 9pm in the recipient's local time.

Before the FCC's 2024 ruling there was real debate about whether a conversational AI voice was "prerecorded". The FCC resolved it for now: a voice created by AI, even one that responds in real time, is treated as artificial. Practically, that puts AI sales calls on the stricter side of the TCPA.

The risk is financial. Statutory damages are commonly described as $500 per call, rising to as much as $1,500 per call for wilful violations, and plaintiffs can bring claims as a class. A list of 10,000 numbers without valid consent is a very expensive mistake.

## The consent question

TCPA consent comes in two practical grades.

| Call purpose | Typical consent standard |
|---|---|
| Informational (appointment reminders, delivery updates) | Prior express consent, often satisfied by the person giving you their number for that purpose |
| Marketing and telemarketing | Prior express written consent |

Prior express written consent has specific content. It should be a signed agreement (an electronic signature or a checked box can count) that:

- Authorises the specific seller to deliver marketing calls using an autodialler or artificial voice.
- Identifies the phone number the calls will go to.
- Is not a condition of buying anything.

The FCC adopted a "one-to-one" consent rule in 2023 for lead generators, requiring consent to name a single seller, but a federal court vacated it in early 2025. Treat any rules about shared lead consent as unsettled, and make sure the consent you rely on clearly names your business or is plainly covered by it.

### What counts as a defensible record

If you are challenged, you will need more than a spreadsheet column that says "opted in". Keep, per contact:

1. The exact wording shown to the person at the time.
2. The date, time and source (form URL, campaign, event).
3. The phone number consented to and the way consent was captured.
4. Any later revocation, with its date.

Purple Voice campaigns include a consent confirmation step at launch, which is a prompt for you to confirm your list is lawful to call. It is a checkpoint, not a record system, so keep your own consent evidence outside the tool.

## Revocation: stopping means stopping

People can revoke consent in any reasonable way, including by saying so on the call. The FCC's rules have been updated to say that revocation requests must be honoured within a short period and across related calls from the same business, and some of those updates have had phased or delayed effective dates, so check the current timetable.

For an AI agent that means:

- The prompt should say that "stop calling me", "remove me" and similar phrases end the call politely and flag the contact.
- The flagged contact must be suppressed across every campaign, number and agent, not just the one in progress.
- Your team should never re-import a suppressed number from an old list.

Our guide to [do-not-call lists and dialer hygiene](/blog/do-not-call-lists-and-dialer-hygiene) covers the suppression workflow in more detail.

## Calling hours, retries and frequency

Calling windows are easy to automate and easy to get wrong. Set campaign hours in the recipient's timezone, and be careful with lists that mix regions. State rules can be stricter than the federal 8am to 9pm window, and a few states restrict the number of attempts or the days you can call.

Retries are a compliance topic as well as a conversion one. Purple Voice lets you set up to five retries with retry hours per campaign. A sensible cap is lower than the maximum when leads have not recently engaged. For timing ideas, see [the best time to call leads](/blog/best-time-to-call-leads).

## State "mini-TCPA" laws

A number of states have added their own telemarketing laws, some covering text messages and calls, some requiring telemarketer registration or bonds, and some with their own private right of action. If you call nationally, you cannot treat the federal law as the ceiling. Keep a list of the states you call into, and have counsel review the ones that matter to your volume.

## Practical rules for an AI calling programme

- **Call people who asked to be called.** Inbound form fills, demo requests and reactivated opted-in customers are the cleanest starting point.
- **Do not buy and dial.** Purchased lists with no consent trail are where AI cold calling goes wrong fastest.
- **Disclose that it is an AI.** Disclosure is covered in [how to disclose AI on calls](/blog/disclose-ai-on-calls), and some rules require it.
- **Give a way out.** The agent should offer a callback or opt-out without pressure.
- **Keep transfers honest.** If the agent hands the call to a human, the human takes over under the same consent and the same rules. See [warm transfer from AI to human](/blog/warm-transfer-ai-to-human).
- **Log everything.** Recordings, transcripts and summaries become evidence. Make sure your retention policy matches your legal advice.

## What the TCPA does not tell you

The TCPA is not a rulebook for conversations. It says little about what the agent can say on a call, which is covered by the FTC's Telemarketing Sales Rule, state consumer protection law, and industry rules such as those for insurance, finance and healthcare. If you are in a regulated industry, those rules often matter more than the TCPA.

## Try it

If your leads have consented to be called, the Free plan lets you test an AI agent with 100 contacts and 100 minutes a month, with no card. Start at [voice.purplerocket.co](https://voice.purplerocket.co), make a test call to your own phone, and see the [overview of legality across regions](/blog/is-ai-cold-calling-legal) before you scale.
