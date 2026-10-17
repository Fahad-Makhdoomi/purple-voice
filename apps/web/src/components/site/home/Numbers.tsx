import { CountUp, Reveal } from '@/components/site/motion';

const STATS = [
  { value: 24, suffix: '/7', label: 'Calling, with no breaks or holidays' },
  { value: 3, label: 'Phone providers supported — keep the number you have' },
  { value: 3, label: 'Voice engines tuned for natural conversation' },
  { value: 1000, suffix: '+', label: 'Call minutes included from $19 a month' },
];

/** A glass band of facts about what a subscription includes. */
export function Numbers() {
  return (
    <section className="relative py-16 text-white sm:py-20">
      <div className="container">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} variant="zoom">
              <div className="glass-dark h-full p-7 text-center">
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
