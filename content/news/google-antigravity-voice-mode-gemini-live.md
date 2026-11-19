---
{
  "slug": "google-antigravity-voice-mode-gemini-live",
  "title": "Google Antigravity adds voice mode built on Gemini Live",
  "seoTitle": "Google Antigravity voice mode runs on Gemini Live",
  "seoDescription": "Google Antigravity voice mode lets developers talk to coding agents and approve permission prompts aloud, built on Gemini Live. What's new and why it matters.",
  "excerpt": "Google's Antigravity 2.29 adds a Gemini Live voice mode for talking to coding agents, plus cloud-based Remote Agents for paid subscribers.",
  "focusKeyword": "google antigravity voice mode",
  "secondaryKeywords": ["gemini live", "antigravity remote agents", "voice interface for ai agents"],
  "category": "Launches",
  "tags": ["ai-voice-news", "google", "gemini-live", "ai-agents"],
  "schemaType": "NewsArticle",
  "faq": [
    {"question": "What is Google Antigravity voice mode?", "answer": "It turns a conversation in Google's Antigravity coding app into a spoken, two-way conversation with the agent. It runs on Gemini Live, which listens to your voice directly and replies aloud in real time."},
    {"question": "Can you approve agent permissions by voice in Antigravity?", "answer": "Mostly. The agent reads each permission request aloud with a recommendation and you can approve or deny by voice. Destructive actions, such as deleting files or force-pushing, must be approved by clicking on screen."},
    {"question": "How do you start voice mode in the Antigravity CLI?", "answer": "In Antigravity CLI version 1.5.0 or later, run /voice live or press F6. In the app, click Start Voice mode with the message box empty."},
    {"question": "What are Antigravity Remote Agents?", "answer": "Cloud-based agents that run in an isolated Google-managed environment and keep working when your laptop is closed. They are rolling out to paid Google AI Pro and Ultra subscribers."}
  ],
  "howToSteps": [],
  "publishedAt": "2026-11-06"
}
---
Google added voice mode to its Antigravity agent development app on November 6, 2026, built on Gemini Live. Google Antigravity voice mode lets developers talk to the coding agent, steer it mid-task and answer its permission prompts out loud. The same release, version 2.29, also introduced Remote Agents, which keep running in Google's cloud after you close your laptop.

It is a developer tool, not a phone product. It is still one of the clearer signs that voice is becoming a normal way to work with AI agents rather than a feature for consumer assistants only.

## What Google announced

According to Google's Antigravity blog and 9to5Google's coverage of the release:

**Voice mode**

- Turns an existing Antigravity conversation into a spoken, two-way exchange, so the agent keeps the context it already has.
- Runs on Gemini Live, which hears your voice directly instead of working from a transcript, replies aloud and can be interrupted.
- You can add details, correct course, ask for status, or say "stop" or "hold on" while a task runs.
- **Permission prompts are read aloud** with the agent's recommendation, and you can approve or deny by voice. Destructive actions, such as deleting files, elevated-privilege commands or force-pushing to Git, still need an on-screen click to approve, though you can deny them by voice.
- The agent stays quiet by default. Saying "keep me posted" gets updates about every 30 seconds.
- Nine voices and playback speeds from 0.75x to 2x.
- Available in the Antigravity app and in the Antigravity CLI from version 1.5.0 (`/voice live` or F6).

Voice mode only reaches the conversation it was started in, and Google says tasks that are still running after you hang up continue in the background.

**Remote Agents**

- Cloud agents created from a GitHub repo or Google Drive folder, each in an isolated environment.
- Rolling out to paid Google AI Pro and Ultra subscribers.
- Controllable from a phone at antigravity.google.com/remote, including unblocking permission requests.

The 2.29 update also redesigned the app's layout and its built-in browser.

## Why it matters for teams that sell or support by phone

The interesting part is not coding. It is how Google designed a voice agent that takes actions.

**Confirmation by voice, with limits.** Antigravity lets low-risk actions be approved by voice and keeps high-risk ones behind a click. Phone agents face the same question every time they book, cancel, transfer or update a record. A useful rule is that a spoken "yes" is fine for reversible actions, and anything costly or permanent gets a second confirmation, like a text or email the customer has to act on.

**Quiet by default.** The agent doesn't narrate everything it does. On sales calls, the same principle applies. Callers want the answer, not a description of the lookup. Our [list of AI voice agent mistakes](/blog/ai-voice-agent-mistakes-to-avoid) includes over-talking for that reason.

**Speech-to-speech is spreading.** Gemini Live hears audio directly rather than transcribing first. That is the same realtime approach used in phone agents, and it trades some control for lower latency and more natural turn-taking. Our explainer on [realtime vs cascaded voice AI](/blog/realtime-vs-cascaded-voice-ai) covers when each fits.

## What to watch next

- Whether voice mode reaches Remote Agents and cloud sessions, which it does not support today.
- Wider rollout. Some reports describe voice mode as arriving gradually across accounts.
- Other agent tools adding voice. When developers get used to talking to agents, buyers tend to expect the same from business software.
- New Gemini Live versions, which also power phone agents built on Google's models.

## What this means if you run AI calling

Purple Voice offers Gemini Live as one of the AI layers our team can set up per customer, alongside OpenAI Realtime and cascaded Deepgram speech with Claude, OpenAI or Gemini. Releases like this one show where these models are being tuned: interruptions, short replies and confirming actions safely. If you want to hear how that sounds on a sales call, build an agent and test-call it on your own phone on the [Free plan](/pricing). No card needed. For the basics first, see [how AI voice agents work](/blog/how-ai-voice-agents-work).

## Sources

- [Google Antigravity blog: Voice mode](https://antigravity.google/blog/antigravity-voice-mode)
- [9to5Google: Google Antigravity gets Remote Agents, Voice Mode and more](https://9to5google.com/2026/11/06/google-antigravity-remote-agents-voice-mode/)
