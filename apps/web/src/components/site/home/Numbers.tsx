import { CountUp, Reveal } from '@/components/site/motion';

const STATS = [
  { value: 24, suffix: '/7', label: 'Calling, with no breaks or holidays' },
  { value: 3, label: 'Phone carriers supported: Twilio, Plivo, SuperPhone' },
  { value: 3, label: 'AI engines to choose from: OpenAI, Gemini, Claude' },
  { value: 1000, suffix: '+', label: 'Call minutes included from $19 a month' },
];

/** A glass band of facts about what a subscription includes. */
export function Numbers() {
  return (
    <section className="relative isolate overflow-hidden bg-night py-16 text-white sm:py-20">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_50%_0%,rgb(var(--pv-violet-700)/0.35),transparent)]"
        aria-hidden="true"
      />
      <div className="container">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} variant="zoom">
              <div className="glass h-full p-6 text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <CountUp
                    value={s.value}
                    suffix={s.suffix}
                    className="text-5xl font-light tracking-tight text-white"
                  />
                  <span className="mt-2 block text-sm text-white/55">{s.label}</span>
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
