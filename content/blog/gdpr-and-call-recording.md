---
{
  "slug": "gdpr-and-call-recording",
  "title": "GDPR and call recording: lawful basis, notices and retention for AI calls",
  "seoTitle": "GDPR and call recording: lawful basis, notices, retention (2026)",
  "seoDescription": "GDPR call recording for AI voice agents: pick a lawful basis, tell callers, set retention, handle access requests and vendors. A practical, non-legal guide.",
  "excerpt": "Recording and transcribing calls is processing personal data. Here is how to choose a lawful basis, tell people, limit retention and handle vendors when an AI agent takes the call.",
  "focusKeyword": "gdpr call recording",
  "secondaryKeywords": ["recording calls gdpr", "call recording lawful basis", "ai call transcripts personal data"],
  "category": "Compliance",
  "tags": ["compliance", "gdpr", "data-protection"],
  "cover": "/images/blog/covers/gdpr-and-call-recording.webp",
  "schemaType": "BlogPosting",
  "faq": [
    {"question": "Do I need consent to record calls under GDPR?", "answer": "Not always. GDPR gives you several lawful bases and consent is only one. Many businesses rely on legitimate interests or contract for recording, but you must be transparent, document your reasoning and, in some countries, also meet separate recording or ePrivacy rules."},
    {"question": "Do I have to tell callers I am recording?", "answer": "Yes, you must be transparent about it. The usual approach is a short statement at the start of the call and a fuller explanation in your privacy notice."},
    {"question": "How long can I keep call recordings?", "answer": "GDPR does not set a number. You should keep recordings no longer than needed for the purpose you stated, and set a defined retention period. Many organisations choose a few months unless a dispute or regulation requires longer."},
    {"question": "Are AI call transcripts personal data?", "answer": "Almost always. A transcript can contain a name, phone number, address, voice characteristics and anything else the person says. Treat transcripts and summaries with the same care as recordings."},
    {"question": "Can people ask for their call recording?", "answer": "Yes. A person can make a subject access request for personal data about them, which can include recordings and transcripts. You need a way to find and provide or redact them within the legal timeframe."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-08-25"
}
---
When an AI voice agent records or transcribes a call, you are processing personal data under GDPR, so GDPR call recording rules apply: you need a lawful basis, you must tell callers, you should keep recordings only as long as you need them, and you must be able to honour access and deletion requests. This guide covers the main decisions in plain terms.

This is general information, not legal advice. UK and EU rules differ in detail and keep changing, and regulators publish guidance that is worth reading directly. Check current requirements, and speak to a data protection adviser for your own set-up.

## Why recordings are personal data

A recording captures a person's voice, which is personal data. It also usually captures a name, a phone number and whatever they say about their situation, which might be sensitive. Transcripts, summaries and sentiment labels generated from the recording are also personal data, even if they feel less intrusive.

That means a normal AI calling workflow touches personal data in at least five places:

1. The contact list you upload.
2. The live audio stream during the call.
3. The stored recording, if you keep it.
4. The transcript and AI summary.
5. Anything sent onwards by webhook or integration, such as a CRM note.

Each one needs a purpose, a basis and a retention decision.

## Choosing a lawful basis

GDPR offers six lawful bases. For call recording, three are common.

| Basis | Fits when | Watch out for |
|---|---|---|
| Consent | Recording is optional, or you are recording for a purpose people can refuse, such as training | It must be freely given and easy to withdraw, so the call cannot be refused if they say no |
| Legitimate interests | You record to check quality, resolve disputes, prove what was agreed or train staff | You must document a balancing test and give people a way to object |
| Contract | You need the recording to perform a contract with the person | Rarely fits a first sales call |

A lot of teams use legitimate interests for quality and dispute handling. That needs a short written assessment: what is the purpose, is recording necessary for it, and do the person's rights outweigh it. If the call involves special category data, such as health, extra conditions apply. Clinics should read [AI calling for dental and medical clinics](/blog/ai-calling-for-dental-and-medical-clinics) with that in mind.

### Marketing is a separate question

The basis for recording is separate from the basis for making the call. A call made for marketing has its own rules on consent and objection, covered in [PECR and AI calls in the UK](/blog/uk-pecr-ofcom-ai-calls) and the overview in [is AI cold calling legal](/blog/is-ai-cold-calling-legal).

## Telling people: notices and call openers

GDPR's transparency principle requires you to explain what you are doing in plain language. Do this in two layers.

**On the call.** A short line at the start works:

> "Hi, this is the assistant from Northside Roofing, an AI voice agent. This call may be recorded and transcribed so we can keep an accurate record. Is now an okay time to talk?"

**In your privacy notice.** Say what is recorded, why, who has access, which suppliers process it, how long you keep it, and how people can exercise their rights. Link it from the page where leads give their number.

Keep the opener honest and short. Our post on [how to disclose AI on calls](/blog/disclose-ai-on-calls) covers wording that does not kill the conversation.

## Recording laws are not only GDPR

Telephone recording is also governed by other laws. In the UK, recording rules sit in part under telecommunications regulations that allow recording for specific business purposes. In some EU countries, national law is stricter. Outside Europe, many US states require every party to a call to consent to recording, and calls cross state lines easily. If you call across regions, adopt the strictest reasonable standard in your opener.

## Retention: decide the number, then enforce it

GDPR's storage limitation principle says you should not keep personal data longer than necessary. There is no fixed period. A workable approach:

- **Recordings:** a short fixed window, such as a few months, unless a dispute, complaint or sector rule requires longer.
- **Transcripts and summaries:** possibly longer, since they are smaller and more useful for the sales record, but still with a stated limit.
- **Suppression records:** keep the minimum needed to ensure you do not call someone who has opted out. That is a legitimate reason to retain a phone number.

Write the periods down. Regulators and courts ask for the policy and for evidence you follow it.

## Vendors, processors and where data goes

When you use an AI calling platform, it is usually your processor, and so are the telephony carrier and the AI model providers behind the agent. GDPR expects:

- A data processing agreement with each processor.
- A list of sub-processors you can show people.
- A lawful transfer mechanism if data leaves the UK or EEA.
- Security measures proportionate to the risk.

Purple Voice runs on your own phone numbers with providers such as Twilio, Plivo or SuperPhone, and the Purple Voice team manages the AI layer for each customer. Ask us for the specifics that apply to your plan and region when you do your own vendor review, rather than assuming.

## Subject access, deletion and objection

Be ready for these requests before they arrive:

- **Access.** Someone asks what you hold on them. You need to find the recording, transcript and summary and respond within the legal period.
- **Erasure.** Someone asks you to delete their data. Remove recordings and transcripts, keep only what you must, and propagate deletions to downstream systems such as the CRM.
- **Objection to marketing.** Stop, record it and suppress the number everywhere.

In the Calls section of the dashboard you can review transcripts, summaries and recordings for each call, which helps when you need to locate a specific one. For the CRM side, see [AI call summaries and CRM notes](/blog/ai-call-summaries-and-crm-notes).

## Automated decisions and scoring

If your agent qualifies leads and the outcome affects what a person gets, such as being refused a service, GDPR's rules on automated decision-making may be relevant. For most sales qualification, a human reviews the outcome and the stakes are low, but keep a human in the loop for decisions that have significant effects. See [AI lead qualification calls](/blog/ai-lead-qualification-calls) for how to structure scoring.

## A short GDPR checklist for AI calls

1. Decide the purpose of recording and write it down.
2. Choose a lawful basis and document the reasoning.
3. Add a recording notice to the call opener and to your privacy notice.
4. Define retention for recordings, transcripts and summaries.
5. Sign data processing agreements with each supplier.
6. Build a process for access, erasure and objection requests.
7. Restrict who can listen to or export recordings.
8. Run a data protection impact assessment if the processing is large scale or sensitive.

## Try it

You can test how Purple Voice handles recorded and transcribed calls without committing to anything: the Free plan includes one agent, one number and 100 minutes a month, no card needed. Start at [voice.purplerocket.co](https://voice.purplerocket.co), run a test call on your own phone, and review the transcript and summary in the dashboard before you decide on your retention policy.
