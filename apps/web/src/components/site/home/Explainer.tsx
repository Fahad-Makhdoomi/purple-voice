import { Reveal } from '@/components/site/motion';
import { SampleCall } from './SampleCall';

const STEPS = [
  {
    title: 'Add your leads',
    body: 'Upload a CSV, connect your CRM or point your existing number at the agent.',
  },
  {
    title: 'Your agent calls them',
    body: 'Within minutes of the enquiry. It answers questions from your own material and hands hot leads to your team.',
  },
  {
    title: 'The meeting is booked',
    body: 'It offers real free slots from your calendar, sends the invite and writes up the call.',
  },
];

/**
 * How it works, next to a real recording of the agent doing it: three steps
 * on the left, the call itself (audio, waveform, transcript) on the right.
 */
export function Explainer() {
  return (
    <section
      id="demo"
      className="relative scroll-mt-24 py-section text-white"
      aria-labelledby="how-title"
    >
      <div className="container grid items-center gap-14 lg:grid-cols-[1fr_minmax(0,500px)] lg:gap-20">
        <div>
          <Reveal>
            <p className="eyebrow text-brand-300">How it works</p>
            <h2
              id="how-title"
              className="mt-3 max-w-xl text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              Listen to it book a meeting.
            </h2>
            <p className="mt-4 max-w-xl text-lead text-white/65">
              Ava, an agent built on Purple Voice, follows up a homeowner who asked for a solar
              quote. She answers the price question and books the consult in under a minute.
            </p>
            <p className="mt-2 text-xs text-white/40">Sample call, voiced for this demo.</p>
          </Reveal>

          <ol className="mt-10 max-w-xl border-t border-white/10">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="border-b border-white/10">
                <Reveal delay={i * 90} className="grid grid-cols-[48px_1fr] gap-x-2 py-5">
                  <span className="num pt-0.5 font-mono text-sm text-white/40">0{i + 1}</span>
                  <span>
                    <h3 className="text-[17px] font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-white/60">{body}</p>
                  </span>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        <Reveal variant="fade">
          <div id="listen" className="scroll-mt-28">
            <SampleCall />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
