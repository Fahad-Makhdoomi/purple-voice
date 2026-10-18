---
{
  "slug": "do-not-call-lists-and-dialer-hygiene",
  "title": "Do not call list compliance: scrubbing, suppression and dialer hygiene",
  "seoTitle": "Do not call list compliance: scrubbing and suppression guide",
  "seoDescription": "A practical guide to do not call list compliance for AI and human callers: how to scrub lists, run a suppression file, set calling hours and keep proof.",
  "excerpt": "Do-not-call rules are mostly about process. Here is a working routine for scrubbing, suppressing and proving you did it, whether calls come from people or an AI agent.",
  "focusKeyword": "do not call list compliance",
  "secondaryKeywords": ["dnc scrubbing", "suppression list", "tps screening"],
  "category": "Compliance",
  "tags": ["compliance", "dnc", "dialer"],
  "cover": "/images/blog/covers/do-not-call-lists-and-dialer-hygiene.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "What is do not call list compliance?", "answer": "It is the set of steps that make sure you do not make marketing calls to people who have registered or told you they do not want them. It covers national registries, your own internal list, calling hours and the records that prove you followed the process."},
    {"question": "How often should I scrub my calling list?", "answer": "Scrub before every campaign, and keep to the registry's own rules on how recent a scrub must be. In the US the rule is commonly described as scrubbing at least every 31 days. In the UK, TPS data is updated regularly, so screening shortly before dialling is sensible."},
    {"question": "What is the difference between a DNC list and a suppression list?", "answer": "A DNC list is usually a registry such as the US National Do Not Call Registry or the UK TPS. A suppression list is your own file of numbers that must never be called, built from opt-outs, complaints and past requests."},
    {"question": "Does an AI agent need to honour do not call requests on the call?", "answer": "Yes. If someone says to stop calling, the agent should acknowledge it, end the call politely and record the request so the number is added to your suppression list across all campaigns."},
    {"question": "Are there calling hours I must follow?", "answer": "Many places restrict calling to daytime and evening hours. In the US, federal telemarketing rules generally allow calls between 8am and 9pm in the recipient's local time, and states can be stricter. Check the rules for every region you call."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-09-01"
}
---
Do not call list compliance comes down to one habit: before any marketing call goes out, check that the number is allowed to receive it, and keep proof that you checked. Registries, your own suppression file and calling-hour limits are all part of the same routine. That matters more, not less, when an AI agent can dial hundreds of numbers in an afternoon.

This is general information, not legal advice. Rules differ by country and state and change over time, so check current requirements for each region you call.

## The lists you need to think about

Four different lists get confused with each other. Keeping them separate makes the process clearer.

| List | What it is | Who owns it |
|---|---|---|
| National registry | Government or regulator-run register, such as the US National Do Not Call Registry or the UK TPS and CTPS | Regulator |
| State or regional lists | Extra state-level registers in some US states, and national lists in other EU countries | State or country |
| Internal suppression list | Your own numbers that must never be called again | You |
| Consent list | People who have actively agreed to be contacted | You |

A consent record can override a registry in some places, for example when someone gives written permission to a specific seller, but only if it is genuine, recent and specific. Do not use it as a loophole for old or vague permissions. For consent rules by region, see [is AI cold calling legal](/blog/is-ai-cold-calling-legal), [TCPA and AI voice calls](/blog/tcpa-and-ai-voice-calls) and [PECR and AI calls in the UK](/blog/uk-pecr-ofcom-ai-calls).

## Build the suppression file first

Your internal suppression list is the most important list because it is the one nobody else maintains. A good one:

- Contains the phone number in a normalised format, such as E.164 (+14155550123), so that formatting differences do not hide duplicates.
- Records the date, source and reason for each entry: opt-out on a call, written request, complaint, wrong number.
- Is global across campaigns, agents, phone numbers and any tools that dial, including a human team's dialler.
- Is checked automatically at upload, not by hand.

Treat "wrong number" and "deceased" outcomes as suppression events too. They are rarely a legal requirement but they protect your reputation and your answer rates.

## A scrubbing routine that works

For each campaign, run the same steps in the same order.

1. **Clean the file.** Normalise numbers, remove duplicates, drop obviously invalid ones. The [lead list preparation checklist](/resources/lead-list-preparation-checklist) covers formatting in detail.
2. **Check consent.** Confirm each contact has a documented reason to be called. Remove anyone who does not.
3. **Remove suppression matches.** Compare against your own suppression list first.
4. **Screen against registries.** Use the relevant national and state registers for each region in the list, and keep the date.
5. **Respect timezones.** Add timezone to each contact so you can restrict calls to permitted hours locally.
6. **Archive the final file** with the date, the registry versions used and the person who ran the check.
7. **Launch.** Only then upload to the dialling platform.

### How fresh does the scrub need to be?

Registries publish new data on a schedule, and some rules specify a maximum age for the scrub. In the US, the commonly cited standard is that a business must use a version of the registry that is no more than 31 days old. In the UK, the TPS data refreshes regularly and screening immediately before a campaign is the safest habit. If your campaign runs for weeks, rescrub partway through. Do not assume a list that was fine in March is fine in June.

## Calling hours and retries

Hours restrictions sit alongside list restrictions, and they are easy to automate once you set them properly.

- Set campaign hours in the recipient's local time. If the list spans multiple timezones, use a timezone field on each contact.
- Keep to the strictest rule that applies. In the US, federal rules generally permit telemarketing calls from 8am to 9pm local time, and some states are tighter, including on certain days.
- Do not retry endlessly. A cap on attempts per contact is both a compliance control and a courtesy.

Purple Voice campaigns have calling hours, up to five retries and separate retry hours, and a progress bar plus not-reached analytics so you can see who has been attempted. For cadence ideas, see [best time to call leads](/blog/best-time-to-call-leads) and [lead follow-up cadence](/blog/follow-up-cadence-for-new-leads). The hours are a control you set, so the compliance of those hours is on your list and your region, not the tool.

## Handling opt-outs during a call

An AI agent has to deal with "take me off your list" in real time. Put this explicitly in the prompt:

> If the person asks not to be called again, apologise briefly, confirm that you will remove their number, end the call, and mark the outcome as "do not call".

Then make sure your process closes the loop:

1. The agent marks the call outcome.
2. The number is added to the suppression list within hours, not weeks.
3. The list is applied to every active and future campaign.

Check transcripts for phrases such as "stop calling", "remove me", "don't call again" and "this is a wrong number". Those phrases should always lead to a suppression entry. A webhook or automation can add the number to your list automatically, a topic covered in [AI voice agent API and webhooks](/blog/ai-voice-agent-webhooks-and-api).

## Proving you did it

If a complaint or a claim arrives, the question will be "what did you check, and when?" Keep:

- The final dialled list, with the date it was scrubbed.
- Evidence of the registry version or screening service used.
- Your suppression list and its change history.
- Call logs, recordings and transcripts, subject to your retention policy (see [GDPR and call recording](/blog/gdpr-and-call-recording)).
- Written procedures and the name of who is accountable.

It is dull paperwork, and it is the thing that separates a defensible incident from an expensive one.

## Common mistakes

- Scrubbing once at list purchase, then dialling for months.
- Keeping a separate suppression file for each campaign.
- Normalising numbers inconsistently, so +44 7700 900123 and 07700 900123 are treated as different people.
- Treating a business number as exempt without checking whether it is a mobile or belongs to a sole trader.
- Leaving a retry setting at its maximum on a low-intent list.

## Try it

If you want to test your own routine, start with a small consented list on the Free plan: 1 agent, 1 number, 100 contacts, no card. Set conservative calling hours, make a few calls to your own phone first, and see how the suppression process fits in. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
