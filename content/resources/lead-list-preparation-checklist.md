---
{
  "slug": "lead-list-preparation-checklist",
  "title": "Lead list preparation checklist for calling campaigns",
  "seoTitle": "Lead list preparation checklist: format, dedupe, consent and timezones",
  "seoDescription": "A lead list preparation checklist for calling campaigns: column format, phone number cleaning, deduplication, consent, suppression and timezone checks.",
  "excerpt": "Clean the list before you call it. Columns, phone formatting, dedupe, consent, suppression and timezones in one checklist.",
  "focusKeyword": "lead list preparation checklist",
  "secondaryKeywords": ["prepare lead list for calling", "clean contact list for cold calling", "call list format"],
  "category": "Checklists",
  "tags": ["checklist", "lead-lists", "campaigns"],
  "cover": "/images/resources/covers/lead-list-preparation-checklist.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "How do you prepare a lead list for a calling campaign?", "answer": "Standardise the columns, convert phone numbers to one international format, remove duplicates and invalid numbers, check consent and suppression lists, add timezone information and test with a small batch before the full upload."},
    {"question": "What format should phone numbers be in?", "answer": "Use international E.164 format, which starts with a plus sign and the country code with no spaces or brackets, for example +14155550123. This avoids dialling errors across providers."},
    {"question": "How do you remove duplicates from a call list?", "answer": "Match on the cleaned phone number first, then on email. Keep the most recent or most complete record, and note the source of the one you remove."},
    {"question": "Do I need consent to call everyone on my list?", "answer": "Rules vary by country, by type of call and by how you got the number. Record where each lead came from and what they agreed to, and check current rules. This is general information, not legal advice."},
    {"question": "Why do timezones matter in a lead list?", "answer": "Calling hours are set by the recipient's local time. A list with no timezone or country data can lead to calls at bad hours, which hurts answer rates and can break local rules."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-10-11"
}
---
A clean list is the cheapest improvement you can make to a calling campaign. This lead list preparation checklist covers six areas: columns, phone numbers, duplicates, consent, suppression and timezones. Work through them in order before you upload, and finish with a small test batch.

It pairs with the [outbound campaign checklist](/resources/outbound-campaign-checklist), which covers hours, retries and launch.

## 1. Set up the columns

Use one header row and one lead per row. A simple structure works for most tools:

| Column | Example | Required |
| --- | --- | --- |
| first_name | Maria | Yes |
| last_name | Lopez | Optional |
| phone | +14155550123 | Yes |
| email | maria@example.com | Optional |
| company | Lopez Dental | Optional |
| country | US | Recommended |
| timezone | America/Los_Angeles | Recommended |
| source | Website form, 2026-09-14 | Yes |
| consent_note | Ticked call consent box | Yes |
| notes | Asked about whitening | Optional |

Checklist:
- [ ] One header row, no merged cells, no blank rows.
- [ ] Column names are consistent and have no spaces at the ends.
- [ ] Context columns (company, notes) are filled where the agent should use them.
- [ ] Saved as CSV in UTF-8 so names with accents survive.

## 2. Clean the phone numbers

- [ ] Convert every number to international format: plus sign, country code, no spaces, brackets or dashes.
- [ ] Remove leading zeros that belong to the local format (for example, a UK number written 07xxx becomes +447xxx).
- [ ] Strip extension text such as "ext 22" and keep it in notes.
- [ ] Remove cells containing more than one number, or split them into separate rows.
- [ ] Remove obvious junk: too short, too long, repeated digits, text entries.
- [ ] Check number type if you can: mobile and landline may need different handling.

Quick check: sort the phone column by length. Outliers at the top or bottom are usually broken entries.

## 3. Remove duplicates

- [ ] Duplicate phone numbers removed after cleaning, not before, since formatting differences hide duplicates.
- [ ] Duplicate emails checked next.
- [ ] Same person at different numbers merged or flagged.
- [ ] Existing customers removed if the campaign is not meant for them.
- [ ] Leads already in another active campaign removed, so nobody gets called twice.

Keep the most recent record, and keep its source and consent note.

## 4. Check consent and source

Rules on calling people differ by country, by whether the call is marketing or service, and by how you obtained the number. This is general information, not legal advice. Check current requirements for each place you call.

- [ ] Every row has a source.
- [ ] Every row has a consent note or lawful basis, kept with a date.
- [ ] Purchased or scraped lists reviewed carefully, and used only where the rules allow.
- [ ] Opt-outs from earlier campaigns excluded.
- [ ] Your team can show how a lead came to be on the list if asked.

The [sales call compliance checklist](/resources/sales-call-compliance-checklist) and [do-not-call lists and dialer hygiene](/blog/do-not-call-lists-and-dialer-hygiene) go deeper.

## 5. Apply suppression lists

- [ ] Your internal do-not-contact list is applied.
- [ ] National or regional do-not-call registers checked where they apply to your calls.
- [ ] Known complainers and hard opt-outs excluded.
- [ ] Competitors and staff removed.
- [ ] Bounced or disconnected numbers from past campaigns removed.

Keep the suppression list in one place and re-apply it before every upload, not once a year.

## 6. Add timezone and calling hours data

Calling hours should reflect the lead's local time.

- [ ] A country column exists for each lead.
- [ ] A timezone is set where the list spans several zones.
- [ ] Area codes or country prefixes used to infer timezones where there is no other data, with exceptions noted.
- [ ] Leads in zones you cannot call within hours are split into separate batches.
- [ ] Calling hours set sensibly, for example mid-morning to early evening on weekdays, adjusted to your market.

See [best time to call leads](/blog/best-time-to-call-leads) for timing ideas.

## 7. Prioritise and segment

- [ ] Newest and warmest leads first.
- [ ] Segments split by source or intent so the agent opens with relevant context.
- [ ] Very old leads placed in a separate campaign with a different opener. See [reactivating old leads with AI calls](/blog/reactivate-old-leads-with-ai-calls).

## 8. Test before the full upload

- [ ] Upload 10 to 20 leads, including your own number and a colleague's.
- [ ] Listen to calls or read transcripts for name pronunciation, context use and anything odd.
- [ ] Fix columns or formatting issues, then upload the rest.
- [ ] Keep a copy of the cleaned file and a log of what you removed and why.

## Pre-upload sign-off

| Check | Done |
| --- | --- |
| Columns standardised | |
| Phone numbers in international format | |
| Duplicates removed | |
| Consent and source recorded | |
| Suppression applied | |
| Timezones set | |
| Test batch reviewed | |

## Try it

Purple Voice campaigns take an uploaded list, calling hours, retries and a consent confirmation, and show progress and not-reached analytics as the campaign runs. Free plan campaigns hold up to 100 contacts, no card needed, which is a handy size for a first cleaned test list. Start at [voice.purplerocket.co](https://voice.purplerocket.co).
