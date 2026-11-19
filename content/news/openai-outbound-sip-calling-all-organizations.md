---
{
  "slug": "openai-outbound-sip-calling-all-organizations",
  "title": "OpenAI opens outbound SIP calling to all organizations",
  "seoTitle": "OpenAI outbound SIP calling now open to all orgs",
  "seoDescription": "OpenAI outbound SIP calling is now available to all organizations through the Live API. What the docs say, the limits, and what it means for AI calling teams.",
  "excerpt": "OpenAI's telephony docs now say outbound SIP calling is available to every organization through the Live API, with E.164 numbers and a TLS/SRTP trunk.",
  "focusKeyword": "openai outbound sip calling",
  "secondaryKeywords": ["openai live api sip", "gpt-live phone calls", "openai telephony"],
  "category": "Launches",
  "tags": ["ai-voice-news", "openai", "sip", "outbound-calling", "telephony"],
  "schemaType": "NewsArticle",
  "faq": [
    {"question": "Does OpenAI support outbound phone calls?", "answer": "Yes. OpenAI's Telephony and SIP guide says outbound SIP calling is available to all organizations through the Live API. You create a session with transport type set to SIP and point it at your own SIP trunk."},
    {"question": "Can I place outbound calls with the Realtime API?", "answer": "Not through the Realtime API call-creation endpoint, according to OpenAI's docs. Outbound calling goes through the Live API. The Realtime SIP docs cover inbound calls."},
    {"question": "What number format does OpenAI outbound SIP use?", "answer": "Both the destination and the caller number must be in E.164 format, such as +14155550123. SIP URI destinations are not supported."},
    {"question": "What are the call limits for OpenAI outbound SIP?", "answer": "The docs list a 3-minute limit on ringing and a 2-hour limit on a connected call, and these cannot be changed in the creation request."},
    {"question": "Do I need my own SIP trunk?", "answer": "Yes. The docs require a trunk that supports TLS signalling and SDES-SRTP media, reached through a sips: provider URL with digest authentication."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-11-03"
}
---
OpenAI outbound SIP calling is now available to all organizations, according to OpenAI's Telephony and SIP developer guide. Outbound calls run through the Live API (the docs' examples use the `gpt-live-1` model), not the Realtime API's call-creation endpoint. Developer coverage dates the change to around November 2, 2026; OpenAI's guide itself carries no date.

In practice, any OpenAI API customer with a compatible SIP trunk can have a speech-to-speech model dial a phone number directly, without a separate media bridge in the middle.

## What the docs say

The relevant line in OpenAI's guide is short: outbound SIP is open to all organizations through the Live API. The rest of the section describes how it works.

- **Creating a call.** You send `POST /v1/live/sessions` with `transport.type` set to `"sip"`, a destination number and your trunk details. A `200 OK` means the session started, not that anyone answered.
- **Numbers.** Destination and caller numbers must be E.164 (for example `+14155550123`). SIP URI destinations are not supported.
- **Your trunk.** The provider URL must use `sips:` (port 5061 by default), with digest authentication. The trunk must support TLS signalling and SDES-SRTP media, and SRTP has to be enabled at your provider.
- **Call progress.** A sideband WebSocket reports `transport.ringing`, `transport.answered` and `transport.failed` events. The docs suggest attaching right after creation, since only the previous 3 seconds of events are replayed.
- **Call control.** DTMF tones go over the sideband. Separate endpoints handle transfer (SIP REFER) and hang-up.

| Limit | Value per OpenAI docs |
| --- | --- |
| Ringing time | 3 minutes |
| Connected call length | 2 hours |
| Configurable per call | No |
| Number format | E.164 only |

### Realtime vs Live naming

Naming is easy to mix up here. The guide covers both the Realtime API and the Live API (GPT-Live). For inbound calls, both have accept, reject, transfer and hang-up flows. For outbound calls, the docs point only to the Live API and say the Realtime call-creation endpoint is not the route. Teams on Realtime who want outbound calling will need to work with the Live API session model. The guide does not describe that as a drop-in swap.

## Why it matters for teams that sell or support by phone

Until now, most production AI calling stacks used a telephony provider's media stream, such as Twilio, bridged to the model over a WebSocket. Native outbound SIP removes a hop. The model provider's infrastructure talks SIP directly to your carrier, which can simplify the media path. Whether it cuts latency in practice depends on your carrier and region, and OpenAI doesn't publish numbers for it.

It doesn't remove the hard parts of outbound calling:

- **Your trunk, your numbers, your rules.** You still own carrier setup, caller ID, number reputation and spam labelling.
- **Compliance stays with you.** Consent, calling hours, do-not-call scrubbing and AI disclosure are not handled by a SIP endpoint. Our guides on [TCPA and AI voice calls](/blog/tcpa-and-ai-voice-calls) and [do-not-call list hygiene](/blog/do-not-call-lists-and-dialer-hygiene) cover the basics. This is general information, not legal advice; check current rules for your market.
- **Campaign logic.** Retries, voicemail handling, booking and CRM write-backs still have to be built around the model.

For build-vs-buy decisions, this tilts things slightly. A small engineering team can now get a model to place a call with less plumbing. The work that decides whether a campaign makes money sits in everything around the call. Our [build vs buy breakdown](/blog/build-vs-buy-ai-voice-agent) goes through that list.

## What to watch next

- A dated OpenAI changelog entry or pricing note confirming the rollout.
- Partner guides. OpenAI's guide links to GPT-Live partner integrations for carrier-specific setup.
- Whether outbound calling comes to the Realtime API, or the Live API becomes the main path for telephony.
- How carriers handle SIPS/SRTP requirements, since not every trunk supports them by default.

## What this means if you run AI calling

Purple Voice runs on OpenAI Realtime among other models, with calls on your own Twilio, Plivo or SuperPhone numbers. New telephony options from model providers are things our team evaluates per customer, not switches you need to flip yourself. If you'd rather run outbound campaigns than build SIP plumbing, you can try Purple Voice on the [Free plan](/pricing) with no card at [voice.purplerocket.co](https://voice.purplerocket.co).

## Sources

- [OpenAI: Telephony and SIP guide](https://developers.openai.com/api/docs/guides/voice-sip)
- [OpenAI: Realtime SIP guide](https://developers.openai.com/api/docs/guides/realtime-sip)
- [Zeli: OpenAI opens outbound SIP calling to every organization](https://zeli.app/story/50399695)
