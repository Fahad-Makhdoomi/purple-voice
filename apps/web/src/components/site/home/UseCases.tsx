import Image from '@/components/ui/Image';
import { Building2, GraduationCap, Home, Megaphone, Stethoscope, Sun } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';

const CASES = [
  {
    icon: Sun,
    title: 'Solar and home services',
    body: 'Call every quote request in minutes and book the site visit.',
  },
  {
    icon: Home,
    title: 'Real estate',
    body: 'Follow up every portal enquiry and schedule the viewing.',
  },
  {
    icon: Megaphone,
    title: 'Agencies',
    body: 'Run campaigns for every client from one workspace.',
  },
  {
    icon: Stethoscope,
    title: 'Clinics and wellness',
    body: 'Answer after hours, take bookings and cut no-shows.',
  },
  {
    icon: GraduationCap,
    title: 'Education and courses',
    body: 'Call every enquiry and book a counsellor for the serious ones.',
  },
  {
    icon: Building2,
    title: 'Finance and insurance',
    body: 'Pre-qualify on the first call; pass ready buyers to advisers.',
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
 * Who it is for: six common situations, each a hoverable glass-on-light card.
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
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={(i % 3) * 80} className="h-full">
                <Spotlight className="glass-dark bento-tile group flex h-full items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <h3 className="text-[16px] font-semibold text-white">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/55">{body}</p>
                  </span>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
