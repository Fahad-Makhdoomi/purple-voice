/**
 * The website's legal pages, written for the EU GDPR, the UK GDPR and Data
 * Protection Act 2018, PECR, and US federal and state law (CCPA/CPRA and the
 * other state privacy laws, the TCPA and the Telemarketing Sales Rule).
 *
 * They are seeded as CMS pages (Admin → Content → Pages) so staff can edit
 * them. {{placeholders}} are filled from Admin → Content → Site settings →
 * Legal details when the page is shown; a line whose placeholder is empty is
 * left out. Have them reviewed by a lawyer for your business before relying
 * on them: they are a thorough starting point, not legal advice.
 */

export interface LegalPage {
  slug: string;
  title: string;
  body: string;
  seoDescription: string;
}

const privacy = `**Effective {{effective_date}}**

This policy explains what personal information {{company_name}} ("we", "us") collects through {{site_name}} — the website at {{site_url}}, the dashboard and the AI calling service — why, how long we keep it, who we share it with and the rights you have. It covers visitors, customers and their team members, and people who receive or make calls handled by {{site_name}}.

## 1. Who we are

{{company_name}} is the controller of the personal information described in sections 3 and 4.

- Address: {{company_address}}, {{company_country}}
- Company number: {{registration_number}}
- VAT number: {{vat_number}}
- ICO registration (UK): {{ico_number}}
- Privacy contact: {{privacy_email}}
- Data protection officer: {{dpo}}
- Our representative in the EU (GDPR art. 27): {{eu_representative}}
- Our representative in the UK (UK GDPR art. 27): {{uk_representative}}

## 2. Two roles: controller and processor

- **For our own customers, website visitors and enquiries** we decide why and how information is used: we are the **controller**.
- **For the people our customers call or who call our customers' numbers** — the contact lists our customers upload, call audio, transcripts, summaries and booked appointments — our customer is the controller and we are their **processor** (a "service provider" or "processor" under US state laws). We use that information only to provide the service to that customer, under our [Data Processing Addendum](/dpa). If you received a call from a business that uses {{site_name}}, see section 11.

## 3. Information we collect

**You give us**
- Account details: name, work email, company, password (stored only as a strong hash) and time zone.
- Billing details: plan, invoices, GST/VAT number and business name. Card, UPI and bank details go straight to our payment providers (Stripe, Razorpay, PayPal); we never see or store them.
- What you set up: agents, prompts, knowledge, campaigns, contact lists, phone-number connections and integrations. Keys and tokens for other services are stored encrypted.
- Messages to us: support tickets, contact-form and Enterprise enquiries, and privacy requests.

**Collected automatically**
- Usage and device data: pages viewed, actions in the dashboard, IP address, browser and device type, and approximate location derived from the IP address.
- Call data: numbers, times, duration, status, minutes used, transcripts, AI summaries, outcomes and sentiment.
- Cookies and similar technologies: see our [Cookie Policy](/cookies). Analytics cookies are only set if you agree.

**From others**
- Google, if you sign in with Google or connect Google Calendar: your name, email and Google account id, and calendar availability and events you allow.
- Payment providers: whether a payment succeeded and the subscription status.

## 4. Why we use it and our lawful basis

| Purpose | Lawful basis (EU/UK GDPR art. 6) |
|---|---|
| Create and run your account, place and answer calls, provide support | Contract |
| Billing, invoicing, tax and accounting records | Contract; legal obligation |
| Keep the service secure, prevent fraud, spam and abuse, enforce our terms | Legitimate interests (a safe, lawful service) |
| Improve the product from aggregated usage | Legitimate interests |
| Website analytics with cookies | Consent (you can withdraw it at any time) |
| Product news and tips by email | Consent; for existing customers, similar-products soft opt-in under PECR. Every email has an unsubscribe link |
| Answer enquiries and privacy requests | Legitimate interests; legal obligation |
| Comply with law and respond to lawful requests | Legal obligation |

Where we rely on legitimate interests you can object (section 9). We do not make decisions about you that have legal or similarly significant effects solely by automated means (GDPR art. 22).

## 5. AI in the service

Calls are handled by AI models from providers chosen by our team (OpenAI, Google Gemini, Anthropic Claude and Deepgram speech). Audio is streamed to the provider during the call to produce speech and text; transcripts and summaries are stored in the customer's workspace. We use these providers' business APIs under terms that do not allow them to use the content to train their models, and set the strictest data-retention options they offer. Agents say they are AI assistants when asked, and messages they send say so.

## 6. Who we share it with

- **Service providers (sub-processors)** who host, run or support the service — listed on our [Sub-processors](/subprocessors) page — under contracts that limit their use of the data.
- **Telephony carriers and integrations you connect** (for example Twilio, Plivo, Google Calendar, Slack, Zapier, your mail server or WhatsApp Business), as you instruct.
- **Payment providers** (Stripe, Razorpay, PayPal), who are independent controllers for payment data.
- **Professional advisers and authorities**: lawyers, accountants and auditors; courts, regulators or law enforcement when the law requires it.
- **A buyer or successor** if our business is merged or sold, under the same protections.

**We do not sell personal information**, and we do not share it for cross-context behavioural advertising.

## 7. International transfers

We and our providers may process information outside the UK and the European Economic Area, including in the United States. When we do, we rely on adequacy regulations or decisions (including the EU-US Data Privacy Framework and its UK extension where the recipient is certified), or on the European Commission's Standard Contractual Clauses with the UK International Data Transfer Addendum, plus additional safeguards where needed. Ask us for a copy.

## 8. How long we keep it

- Account and workspace data: while your account is open. When you delete your account it is erased straight away; nightly backups that still hold it roll off within 14 days.
- Call data (transcripts, summaries, contact lists): as long as the customer keeps it in their workspace, and no longer than the account.
- Billing records: as long as tax and company law requires, usually 6 years (UK) or 7 years (US).
- Enquiries and support tickets: up to 2 years after the last message.
- Cookie consent records: up to 2 years, to show the choice you made.
- Security logs and webhook delivery records: up to 90 days.

## 9. Your rights (EU, EEA and UK)

You can ask us to:
- **access** your personal information and get a copy;
- **correct** it if it is wrong or incomplete;
- **erase** it;
- **restrict** how we use it;
- **port** it to you or another provider in a machine-readable format;
- **object** to processing based on legitimate interests, and to direct marketing at any time;
- **withdraw consent** at any time, without affecting earlier processing.

Signed-in customers can download their data and delete their account from **Dashboard → Settings → Privacy and data**. Anyone can use our [privacy request form](/privacy-choices) or email {{privacy_email}}. We reply within one month (extendable by two months for complex requests) and may ask you to confirm your identity first.

You also have the right to complain to a supervisory authority: in the UK, the Information Commissioner's Office (ico.org.uk); in the EU, the authority where you live or work. We would appreciate the chance to help first.

## 10. Your rights in the United States

Residents of California and other states with privacy laws (including Virginia, Colorado, Connecticut, Utah, Texas, Oregon and others) have these rights, subject to the exceptions in those laws:

- **Know / access** the categories and specific pieces of personal information we hold, its sources, purposes and who we disclose it to.
- **Delete** personal information we collected from you.
- **Correct** inaccurate personal information.
- **Opt out of sale, sharing for targeted advertising, and profiling.** We do not sell or share personal information, and we treat a Global Privacy Control signal from your browser as a valid opt-out request.
- **Limit use of sensitive personal information.** We do not use sensitive personal information to infer characteristics about you.
- **Non-discrimination** for using your rights.
- **Appeal**: if we decline your request, reply to our answer or email {{privacy_email}} with "Appeal" in the subject. If we still decline, you can contact your state Attorney General.

You or an authorised agent can make a request through our [privacy request form](/privacy-choices) or by email at {{privacy_email}}. We verify requests by matching information you give us to our records, and reply within 45 days (extendable once by 45 days).

**Notice at collection.** In the last 12 months we have collected these categories of personal information (California Civil Code 1798.140): identifiers (name, email, IP address, account id); commercial information (plan and purchase history); internet or electronic activity (usage of the site and dashboard); approximate geolocation (from IP address); audio and electronic information (call audio, transcripts, as a service provider to our customers); professional information (company and role). Sources, purposes, retention and recipients are described in sections 3 to 8. We do not sell or share any category.

## 11. If a business called you using {{site_name}}

The business that called you decides why you were called and is responsible for having permission to do so. To stop calls, say so on the call — the agent ends the call and marks your number as do-not-call for that business — or contact the business directly. You can also send us a request through our [privacy request form](/privacy-choices) with your phone number; we will pass it to the business and help them act on it.

## 12. Security

Passwords are hashed with scrypt; keys and tokens are encrypted with AES-256-GCM; connections use TLS; access to customer data is limited, logged and audited; data is backed up nightly. No system is perfectly secure; we will tell you and the regulator about a breach that affects you as the law requires.

## 13. Children

{{site_name}} is a business service. It is not meant for anyone under 18, and we do not knowingly collect information about children under 16.

## 14. Changes to this policy

When we change this policy we update the date above. If the changes are significant, we tell customers by email or in the dashboard before they take effect and ask you to accept them again.

## 15. Contact us

Email {{privacy_email}}, write to {{company_name}}, {{company_address}}, {{company_country}}, or use our [contact page](/contact).
`;

const terms = `**Effective {{effective_date}}**

These Terms of Service ("Terms") are an agreement between {{company_name}} ("we", "us") and the business or person that creates an account ("you") to use {{site_name}}: the AI voice-agent platform, dashboard, API and website at {{site_url}} (the "Service"). By creating an account or using the Service you accept these Terms, our [Acceptable Use and Calling Policy](/acceptable-use) and our [Data Processing Addendum](/dpa). Our [Privacy Policy](/privacy) explains how we handle personal information.

## 1. Who can use the Service

The Service is for businesses and professionals. You must be at least 18 and able to bind the business you sign up for. You are responsible for everyone you let use your account and for keeping your login safe.

## 2. Plans, billing and cancellation

- **Free plan.** The Free plan includes the agents, numbers, campaigns and AI call minutes shown on the [pricing page](/pricing), counted per calendar month. We may change or end the Free plan with 30 days' notice.
- **Paid plans** are billed monthly in advance through Stripe, Razorpay or PayPal and renew until cancelled. Prices exclude taxes, which are added where required.
- **Minutes** are counted per call, rounded up to the next minute, and reset each billing period; unused minutes do not roll over.
- **Phone numbers and carrier charges** (Twilio, Plivo or another carrier) are billed by that carrier to you, on your own account.
- **Cancelling.** You can cancel any time from Billing; the plan stays active until the end of the period you paid for, then your workspace moves to the Free plan. Except where the law says otherwise, payments are not refundable.
- **Late payment.** If a payment fails we may suspend paid features until it is paid.

## 3. Your responsibility for calls and messages

You decide who your agents call and message and what they say. You must comply with every law that applies to your calls and messages, including:

- **United States:** the Telephone Consumer Protection Act (TCPA) and FCC rules — calls using an artificial or AI-generated voice need the called party's prior express consent, and prior express **written** consent for telemarketing; the FCC's ruling that AI-generated voices are "artificial" voices under the TCPA; the Telemarketing Sales Rule; the National Do Not Call Registry and your own internal do-not-call list; state laws (including "mini-TCPA" laws such as those of Florida, Oklahoma and Washington) and calling-hour limits (generally 8 am to 9 pm in the called person's time zone, often stricter under state law); and call-recording consent laws in states that require everyone's consent.
- **United Kingdom:** the Privacy and Electronic Communications Regulations (PECR) — automated marketing calls need prior specific consent, and live marketing calls must not go to numbers registered with the TPS or CTPS unless the person has told you they want your calls; Ofcom's rules on persistent misuse and on showing a valid, contactable caller ID; and the UK GDPR.
- **European Union:** the GDPR and the ePrivacy rules of each country you call.
- **Everywhere:** consumer-protection, anti-spam and sector rules (for example finance, health, debt collection and political calls), and WhatsApp's Business and Commerce policies for messages.

You confirm, for every list you upload, that you have the consent or other lawful basis the law requires, and you keep records of it. You must honour opt-outs straight away. {{site_name}} gives you tools — calling windows, retry limits, do-not-call handling and AI disclosure — but using them does not make a campaign lawful on its own.

## 4. Your data

You own the data you put into the Service ("Customer Data"). You give us permission to host, process and transmit it only to provide and support the Service, as described in the [Data Processing Addendum](/dpa), which forms part of these Terms. You are responsible for the accuracy and lawfulness of Customer Data and for giving people any notices the law requires.

## 5. AI output

AI agents can misunderstand people, make mistakes or say things that are inaccurate. Review your prompts, test your agents and check transcripts and summaries before relying on them. Do not use the Service for emergency calls or to give medical, legal or financial advice, and do not let agents take payment card details over the phone.

## 6. Acceptable use

You must follow the [Acceptable Use and Calling Policy](/acceptable-use). We may suspend an agent, a campaign or an account that breaks it or the law, or that puts others at risk, and will tell you why unless the law prevents us.

## 7. Third-party services

The Service connects to services you choose, such as carriers, Google, payment providers, mail servers and WhatsApp. Their terms govern your use of them, and we are not responsible for them.

## 8. Our service and intellectual property

We own the Service, its software and its content. We give you a non-exclusive, non-transferable right to use it during your subscription. Do not copy, resell, reverse engineer or misuse it. If you send us feedback, we may use it freely.

## 9. Confidentiality

Each of us will keep the other's non-public information confidential and use it only for this agreement, except where the law requires disclosure.

## 10. Availability and changes

We work to keep the Service available and secure but do not promise it will be uninterrupted or error-free. We may improve or change features; if we remove something material from a paid plan, we will tell you in advance.

## 11. Disclaimer

Except as these Terms say, the Service is provided "as is" and we disclaim implied warranties of merchantability, fitness for a particular purpose and non-infringement, to the extent the law allows.

## 12. Limitation of liability

To the extent the law allows, neither of us is liable for indirect or consequential loss, or for lost profits, revenue or data, and each party's total liability under these Terms is limited to the fees you paid us in the 12 months before the claim. Nothing limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law, or your obligations under section 13.

## 13. Your indemnity

You will defend and compensate us against claims, fines and costs arising from your calls and messages, your Customer Data, or your breach of these Terms or the law, including telemarketing and privacy laws.

## 14. Ending the agreement

You can stop using the Service and delete your account at any time from Settings. We may end or suspend your account for serious or repeated breach, non-payment or unlawful use. When the account ends, Customer Data is deleted as described in the [Privacy Policy](/privacy); download what you need first.

## 15. Changes to these Terms

We may update these Terms. We will give at least 30 days' notice of material changes by email or in the dashboard, and ask you to accept them; if you do not agree, you can cancel before they take effect.

## 16. Governing law

These Terms are governed by the laws of {{governing_law}}, and its courts have exclusive jurisdiction, except that either of us may seek urgent relief in any court. Mandatory consumer or data-protection rights where you are based are not affected.

## 17. Contact

{{company_name}}, {{company_address}}, {{company_country}}. Email {{contact_email}}.
`;

const cookies = `**Effective {{effective_date}}**

This policy explains the cookies and similar technologies {{site_name}} uses at {{site_url}}, and how to control them. Cookies that are not strictly necessary are only set after you agree, as the UK PECR, the EU ePrivacy Directive and the GDPR require. Change your choice any time with **Cookie settings** at the bottom of every page, or on [Your privacy choices](/privacy-choices).

## Strictly necessary

Needed for the site and the dashboard to work and be secure. They do not need consent.

| Name | Purpose | Lasts |
|---|---|---|
| pv_at | Keeps you signed in (short-lived access token) | 15 minutes |
| pv_rt | Renews your sign-in securely | 30 days |
| pv_role | Sends you to the right part of the app | 30 days |
| pv_google_nonce | Protects "Continue with Google" sign-in | 10 minutes |
| pv_consent | Remembers your cookie choices | 12 months |
| Captcha (Cloudflare Turnstile, Google reCAPTCHA or hCaptcha, when switched on) | Stops bots on sign-up, sign-in and contact forms | Session to 6 months |
| Payment pages (Stripe, Razorpay, PayPal) | Fraud prevention while you pay | Set by the provider |

## Preferences

We do not use preference cookies today. If we add any (for example to remember a setting you choose), they will be listed here and set only with your consent.

## Analytics

Help us understand how the site is used so we can improve it.

| Name | Provider | Purpose | Lasts |
|---|---|---|---|
| _ga, _ga_* | Google Analytics 4 | Counts visits and how pages are used | Up to 2 years |

Set only if you accept analytics cookies. We may also use Plausible Analytics, which uses no cookies and stores nothing on your device.

## Marketing

We do not currently use advertising or marketing cookies. If we add any, we will list them here and ask for your consent first.

## Global Privacy Control

If your browser sends a Global Privacy Control signal, we treat it as an opt-out of sale, sharing and marketing cookies, and do not set them.

## Managing cookies in your browser

You can also block or delete cookies in your browser settings. Blocking strictly necessary cookies will stop sign-in from working.

## Contact

Questions: {{privacy_email}}.
`;

const dpa = `**Effective {{effective_date}}**

This Data Processing Addendum ("DPA") forms part of the [Terms of Service](/terms) between {{company_name}} ("Processor", "we") and the customer ("Controller", "you"). It applies whenever we process personal data on your behalf in providing {{site_name}}, under the EU GDPR, the UK GDPR, the US state privacy laws (including the CCPA/CPRA) and other data-protection laws ("Data Protection Law").

## 1. Roles and scope

You are the controller (or a processor acting for your controller) of the personal data you put into the Service ("Customer Personal Data"), and we are your processor (and, under the CCPA, your service provider). Annex 1 describes the processing.

## 2. Our obligations

We will:
1. process Customer Personal Data only on your documented instructions — these Terms, your configuration of the Service and your written requests — unless the law requires otherwise, in which case we tell you first where we lawfully can;
2. make sure everyone who processes it is bound by confidentiality;
3. apply the security measures in Annex 2;
4. use sub-processors only as section 3 allows;
5. help you, taking into account the nature of the processing, to answer data-subject requests (the Service lets you export, correct and delete data) and to meet your duties on security, breach notification, impact assessments and consultation with regulators;
6. tell you without undue delay, and in any case within 48 hours, after becoming aware of a personal-data breach affecting Customer Personal Data, with the information you need to meet your own obligations;
7. at the end of the Service, delete Customer Personal Data (you can export it first), except where the law requires us to keep it;
8. make available the information needed to show we comply with this DPA, and allow audits by you or an independent auditor you appoint, on reasonable notice, at most once a year, at your cost, unless a regulator requires otherwise or there has been a breach.

## 3. Sub-processors

You authorise the sub-processors listed on our [Sub-processors](/subprocessors) page. We will give you at least 30 days' notice of a new sub-processor by updating that page and emailing account owners; you may object on reasonable data-protection grounds, and if we cannot address it you may terminate the affected Service. We impose data-protection terms on each sub-processor at least as protective as this DPA and remain responsible for them.

## 4. International transfers

Where Customer Personal Data is transferred outside the UK or EEA to a country without an adequacy decision, the Standard Contractual Clauses adopted by the European Commission (Decision 2021/914; Module 2, or Module 3 where you are a processor) and the UK International Data Transfer Addendum are incorporated into this DPA, with this DPA's details filling their annexes, the law of Ireland governing the EU clauses (and of England and Wales the UK Addendum), and clause 7 (docking) and the optional clause in clause 11 not applying.

## 5. US state privacy laws

As your service provider or processor we will not: sell or share Customer Personal Data; retain, use or disclose it outside our direct business relationship with you or for any purpose other than providing the Service; or combine it with personal data from other sources except as Data Protection Law allows. We will tell you if we can no longer meet our obligations, and you may take reasonable steps to stop unauthorised use.

## 6. Your obligations

You confirm you have a lawful basis, the consents and the notices Data Protection Law and telemarketing law require for the processing you instruct, including for calling and messaging the people on your lists.

## 7. Term and precedence

This DPA lasts as long as we process Customer Personal Data. If it conflicts with the Terms, this DPA prevails; if it conflicts with the Standard Contractual Clauses, the Clauses prevail.

## Annex 1 — Description of the processing

- **Subject matter and duration:** providing the Service, for the term of your subscription plus the deletion period in the Privacy Policy.
- **Nature and purpose:** storing contact lists; placing and answering phone calls with AI voice agents; real-time speech recognition and synthesis; transcripts, summaries, outcomes and analytics; booking appointments; sending emails or WhatsApp messages your agents are set up to send; webhooks and integrations you configure.
- **Data subjects:** your leads, prospects and customers, people who call your numbers, and your users.
- **Personal data:** names, phone numbers, email addresses, company details and any other fields you upload; call audio (processed in real time); transcripts, summaries, outcomes and sentiment; appointment details; message content.
- **Special category data:** not intended. Do not upload it or instruct agents to collect it unless you have a lawful basis and have agreed this with us in writing.
- **Frequency:** continuous while the Service is used.

## Annex 2 — Security measures

- Encryption in transit (TLS 1.2+) and at rest for secrets (AES-256-GCM for carrier credentials, AI keys, OAuth tokens and webhook secrets); passwords hashed with scrypt; API keys stored as hashes.
- Tenant isolation: every query is scoped to the customer's workspace; staff access to a workspace is explicit and audited.
- Access control: least privilege, rotating sessions with reuse detection, captcha and rate limits on public forms.
- Signed callback URLs for telephony providers; SSRF protection for customer-supplied URLs and mail servers.
- Nightly encrypted backups kept for 14 days; monitoring and audit logs.
- Secure development: code review, automated tests, dependency updates and incident response procedures.

## Contact

Data-protection questions: {{privacy_email}}. Data protection officer: {{dpo}}.
`;

const acceptableUse = `**Effective {{effective_date}}**

This policy applies to everyone who uses {{site_name}}. It is part of our [Terms of Service](/terms). We may suspend agents, campaigns or accounts that break it.

## You must

- Have the **consent or other lawful basis** the law requires before your agents call or message anyone, and keep records of it: prior express written consent for AI-voice telemarketing calls in the US (TCPA), prior specific consent for automated marketing calls in the UK (PECR), and a lawful basis under the GDPR.
- **Screen your lists** against the US National Do Not Call Registry, state lists and your internal do-not-call list, and against the UK TPS and CTPS, as the law requires.
- **Call only at permitted times** in the called person's time zone (in the US generally 8 am–9 pm, stricter in some states) — set your campaign's calling window and days accordingly.
- **Stop when asked.** Honour do-not-call and unsubscribe requests immediately and permanently. Our agents end the call and mark the number; you must not re-add it.
- **Identify yourself truthfully.** Agents must name your business, say the purpose of the call, and say they are an AI assistant whenever asked (and at the start of the call where the law requires). Show a real, contactable caller ID that you are allowed to use.
- **Keep retries reasonable.** Campaigns allow at most 5 retries per number; avoid repeated calls that could be persistent misuse under Ofcom's rules.
- **Get recording consent** where the law requires everyone on a call to agree, before you enable recording.
- **Follow WhatsApp's Business and Commerce policies** for messages: use approved templates and only message people who agreed to hear from you.

## You must not

- Make calls or send messages that are unlawful, harassing, threatening, deceptive or fraudulent, or that impersonate a real person or organisation.
- Spoof caller ID or hide your number.
- Call emergency numbers, hospital patient lines, or numbers you know belong to children.
- Use agents to collect payment card numbers, bank passwords, government ID numbers or health records over the phone.
- Make political, debt-collection, healthcare or financial-promotion calls without meeting the extra rules for those calls.
- Send spam, or use the Service to send unsolicited bulk messages.
- Upload data you have no right to use, or special category data (health, religion, biometrics and similar) without a lawful basis and our written agreement.
- Try to break, overload, probe or get around the Service's security, limits or billing, or resell it without our agreement.

## Reporting abuse

If you received an unwanted call or message from a business using {{site_name}}, tell us through our [privacy request form](/privacy-choices) or at {{contact_email}} with the number that called and the time. We investigate every report.
`;

const subprocessors = `**Last updated {{effective_date}}**

These are the third parties that may process personal data for {{site_name}}, under contracts that protect it as our [Data Processing Addendum](/dpa) requires. AI providers are used only for the workspaces our team sets up with them.

| Sub-processor | Purpose | Location |
|---|---|---|
| {{hosting_provider}} | Hosting the application, database and backups | {{hosting_region}} |
| OpenAI | AI voice agents (OpenAI Realtime), call summaries | United States |
| Google (Gemini API) | AI voice agents (Gemini Live), call summaries | United States |
| Anthropic | AI voice agents (Claude), call summaries, AI assistant | United States |
| Deepgram | Speech recognition and synthesis | United States |
| Google (Calendar, Sign-In, Analytics) | Calendar booking and Google sign-in when you connect them; website analytics only with consent | United States |
| Cloudflare | Captcha on public forms, when switched on | Global |
| Our email delivery provider | Account and notification emails | {{hosting_region}} |

**Chosen by you, not sub-processors of ours:** your telephony carrier (Twilio, Plivo or SuperPhone), your mail server, WhatsApp Business, Slack, Zapier, HubSpot and Calendly act under your own agreements with them. **Payment providers** (Stripe, Razorpay, PayPal) are independent controllers of payment data.

We give 30 days' notice before adding a sub-processor. Questions: {{privacy_email}}.
`;

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    body: privacy,
    seoDescription:
      'How Purple Voice collects, uses and protects personal information, and your rights under the GDPR, UK GDPR and US state privacy laws.',
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    body: terms,
    seoDescription:
      'The terms for using Purple Voice, including plans, billing and your responsibilities under calling laws such as the TCPA and PECR.',
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    body: cookies,
    seoDescription:
      'The cookies Purple Voice uses, why, for how long, and how to change your choice.',
  },
  {
    slug: 'dpa',
    title: 'Data Processing Addendum',
    body: dpa,
    seoDescription:
      'Purple Voice’s GDPR article 28 data processing terms, Standard Contractual Clauses, UK Addendum and CCPA service-provider commitments.',
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use and Calling Policy',
    body: acceptableUse,
    seoDescription:
      'What you may and may not do with Purple Voice AI calling: consent, do-not-call lists, calling hours and AI disclosure.',
  },
  {
    slug: 'subprocessors',
    title: 'Sub-processors',
    body: subprocessors,
    seoDescription: 'The third parties that process personal data for Purple Voice, and where.',
  },
];
