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
    <section className="bg-surface py-section" aria-labelledby="cases-title">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Who it is for</p>
          <h2 id="cases-title" className="mt-3 text-h1">
            Any team that lives on the phone
          </h2>
          <p className="mt-4 text-lead text-muted">
            If leads come in faster than your team can call them back, Purple Voice is built for
            you.
          </p>
        </Reveal>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={(i % 3) * 90} className="h-full">
                <Spotlight className="group h-full rounded-lg">
                  <div className="h-full rounded-lg border border-line bg-canvas p-6 transition duration-300 group-hover:border-brand-300 group-hover:bg-white group-hover:shadow-lg">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-ink group-hover:text-white">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-h3">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
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
