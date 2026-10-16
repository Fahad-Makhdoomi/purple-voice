import { CalendarCheck, FileText, PhoneForwarded, Users } from 'lucide-react';
import { LiveCall, Reveal, Spotlight } from '@/components/site/motion';

const SCRIPT = [
  {
    who: 'ai' as const,
    text: 'Hi Dana, it’s Ava from Northwind Solar. You asked about a quote for your roof — is now a good time?',
  },
  { who: 'lead' as const, text: 'Sure, quickly. What would it cost for a 4-bedroom house?' },
  {
    who: 'ai' as const,
    text: 'Most homes your size land between $14k and $19k after incentives. An expert can give you an exact figure in 20 minutes.',
  },
  { who: 'lead' as const, text: 'Okay. Can we do Tuesday morning?' },
  {
    who: 'ai' as const,
    text: 'Tuesday at 10:30 is open. Shall I book it and email you the invite?',
  },
  { who: 'lead' as const, text: 'Yes please.' },
];

const POINTS = [
  {
    icon: Users,
    title: 'You bring the leads',
    body: 'Upload a contact list or answer inbound calls on your own Twilio, Plivo or SuperPhone number.',
  },
  {
    icon: PhoneForwarded,
    title: 'The AI agent has the conversation',
    body: 'It speaks naturally, answers from the knowledge you give it, handles interruptions and transfers to a human when needed.',
  },
  {
    icon: CalendarCheck,
    title: 'Meetings land in your calendar',
    body: 'It checks your Google Calendar mid-call, offers real open slots and sends the invite before it hangs up.',
  },
  {
    icon: FileText,
    title: 'Every call is written up',
    body: 'Transcript, summary, outcome and a lead score for every call, so your team only follows up where it counts.',
  },
];

/**
 * "What is this?" in one screen: a plain-language answer on the left and a
 * sample call playing on the right.
 */
export function Explainer() {
  return (
    <section
      id="demo"
      className="relative scroll-mt-24 py-section text-white"
      aria-labelledby="what-title"
    >
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_minmax(0,480px)]">
        <div>
          <Reveal>
            <p className="eyebrow text-brand-300">What is Purple Voice?</p>
            <h2
              id="what-title"
              className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              A sales rep that never misses a call
            </h2>
            <p className="mt-4 max-w-xl text-lead text-white/70">
              Purple Voice lets you create AI agents that make and take phone calls the way your
              best rep would — qualifying the lead, answering questions and booking the meeting —
              for a flat monthly price instead of a salary.
            </p>
          </Reveal>

          <ul className="mt-9 grid gap-4 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <Reveal delay={i * 90}>
                  <Spotlight className="glass-dark h-full p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-white">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{body}</p>
                  </Spotlight>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Reveal variant="right">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
            Sample call · plays automatically
          </p>
          <LiveCall script={SCRIPT} />
        </Reveal>
      </div>
    </section>
  );
}
