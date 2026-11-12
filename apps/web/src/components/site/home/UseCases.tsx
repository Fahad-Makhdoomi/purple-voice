import Image from '@/components/ui/Image';
import { Reveal } from '@/components/site/motion';

const CASES = [
  {
    title: 'Solar and home services',
    job: 'Calls every quote request within minutes and books the site survey.',
  },
  {
    title: 'Real estate',
    job: 'Follows up portal enquiries, checks budget and area, schedules the viewing.',
  },
  {
    title: 'Clinics and wellness',
    job: 'Answers after hours, books appointments and calls the day before to cut no-shows.',
  },
  {
    title: 'Education and courses',
    job: 'Calls every enquiry and books a counsellor for the serious ones.',
  },
  {
    title: 'Finance and insurance',
    job: 'Pre-qualifies on the first call and passes ready buyers to an adviser.',
  },
  {
    title: 'Agencies',
    job: 'Runs campaigns for each client from one workspace, on each client’s own number.',
  },
];

// Decorative portraits the Minimal theme floats around the heading (kept above the cards): [left %, top px, size px, tilt deg].
const PORTRAITS: Array<[number, number, number, number]> = [
  [3, 0, 84, -4],
  [13, 130, 64, 3],
  [22, 20, 52, 5],
  [75, 10, 60, -3],
  [87, 90, 88, 4],
  [79, 170, 52, -5],
];

function FloatingPortraits() {
  return (
    <div className="float-portraits hidden lg:block" aria-hidden="true">
      {PORTRAITS.map(([left, top, size, tilt], i) => (
        <span
          key={i}
          className="float-portrait"
          style={
            {
              left: `${left}%`,
              top,
              width: size,
              height: size * 1.15,
              '--tilt': `${tilt}deg`,
              '--dur': `${6 + (i % 3)}s`,
              '--delay': `${-i * 0.9}s`,
              '--px': `${30 + (i % 3) * 25}px`,
            } as React.CSSProperties
          }
        >
          <Image
            src={`/images/themes/minimal/portrait-${i + 1}.webp`}
            alt=""
            fill
            sizes="110px"
            className="object-cover"
          />
        </span>
      ))}
    </div>
  );
}

/**
 * Who it is for: six industries and the job the agent does in each.
 * `portraits` floats people around the heading (the Minimal theme).
 */
export function UseCases({ portraits = false }: { portraits?: boolean }) {
  return (
    <section id="use-cases" className="scroll-mt-24 py-section" aria-labelledby="cases-title">
      <div className="container relative">
        {portraits && <FloatingPortraits />}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-300">Use cases</p>
          <h2
            id="cases-title"
            className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
          >
            Built for teams that live on the phone
          </h2>
          <p className="mt-4 text-lead text-white/65">
            If leads arrive faster than you can call them back, this is for you.
          </p>
        </Reveal>
        <Reveal className="mt-10">
          <ul className="glass-dark divide-y divide-white/10 px-6 sm:px-8">
            {CASES.map(({ title, job }) => (
              <li
                key={title}
                className="grid gap-1 py-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-8"
              >
                <h3 className="text-[16px] font-semibold text-white">{title}</h3>
                <p className="text-[15px] leading-relaxed text-white/60">{job}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
