import { CalendarCheck, PhoneCall, Upload } from 'lucide-react';
import { LiveCall, Reveal } from '@/components/site/motion';

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

const STEPS = [
  {
    icon: Upload,
    title: 'Add your leads',
    body: 'Upload a list or let it answer the number you already have.',
  },
  {
    icon: PhoneCall,
    title: 'Your agent calls',
    body: 'It talks naturally, answers from your knowledge and hands hot leads to your team.',
  },
  {
    icon: CalendarCheck,
    title: 'Meetings get booked',
    body: 'Real open slots from Google Calendar, an invite sent, a summary for every call.',
  },
];

/**
 * How it works in one screen: three steps that light up in turn, next to a
 * sample call that plays itself.
 */
export function Explainer() {
  return (
    <section
      id="demo"
      className="relative scroll-mt-24 py-section text-white"
      aria-labelledby="how-title"
    >
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-20">
        <div>
          <Reveal>
            <p className="eyebrow text-brand-300">How it works</p>
            <h2
              id="how-title"
              className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              Your best sales rep, on every call.
            </h2>
            <p className="mt-4 max-w-xl text-lead text-white/65">
              Set it up in an afternoon. From then on every lead gets a call within minutes, day or
              night.
            </p>
          </Reveal>

          <ol className="steps relative mt-10 space-y-3">
            <span className="steps__rail" aria-hidden="true" />
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <Reveal delay={i * 120}>
                  <div
                    className="step glass-dark flex items-start gap-4 p-4 sm:p-5"
                    style={{ '--step': i } as React.CSSProperties}
                  >
                    <span className="step__icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="flex items-center gap-2 text-[17px] font-semibold text-white">
                        <span className="text-xs font-semibold text-white/40">0{i + 1}</span>
                        {title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
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
