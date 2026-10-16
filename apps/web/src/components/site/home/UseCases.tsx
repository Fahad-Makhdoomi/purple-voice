import { Building2, GraduationCap, Home, Megaphone, Stethoscope, Sun } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';

const CASES = [
  {
    icon: Sun,
    title: 'Solar and home services',
    body: 'Call every quote request within minutes, qualify the roof and the bill, and book the site visit.',
  },
  {
    icon: Home,
    title: 'Real estate',
    body: 'Follow up on every portal enquiry, confirm budget and timeline, and schedule viewings.',
  },
  {
    icon: Megaphone,
    title: 'Agencies',
    body: 'Run outbound campaigns for each client from one workspace, with a separate agent per brand.',
  },
  {
    icon: Stethoscope,
    title: 'Clinics and wellness',
    body: 'Answer inbound calls after hours, take bookings and send reminders to cut no-shows.',
  },
  {
    icon: GraduationCap,
    title: 'Education and courses',
    body: 'Call every enquiry, explain the programme and book a counsellor for the serious ones.',
  },
  {
    icon: Building2,
    title: 'Finance and insurance',
    body: 'Pre-qualify leads on the first call and pass only ready buyers to your licensed advisers.',
  },
];

/** Who it is for: six common situations, each a hoverable glass-on-light card. */
export function UseCases() {
  return (
    <section id="use-cases" className="scroll-mt-24 py-section" aria-labelledby="cases-title">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-300">Use cases</p>
          <h2
            id="cases-title"
            className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
          >
            Any team that lives on the phone
          </h2>
          <p className="mt-4 text-lead text-white/65">
            If leads come in faster than your team can call them back, Purple Voice is built for
            you.
          </p>
        </Reveal>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={(i % 3) * 90} className="h-full">
                <Spotlight className="group h-full rounded-lg">
                  <div className="glass-dark h-full p-6 transition duration-300 group-hover:bg-white/[0.07]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-[22px] font-medium tracking-[-0.02em] text-white">
                      {title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/55">{body}</p>
                  </div>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
