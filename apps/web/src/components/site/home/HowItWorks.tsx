import { Bot, PhoneCall, Rocket } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';

const STEPS = [
  {
    icon: PhoneCall,
    title: 'Connect your number',
    body: 'Add your Twilio or Plivo account and pick a number. We route its calls to your agents — no porting, no hardware.',
  },
  {
    icon: Bot,
    title: 'Build your agent',
    body: 'Write who it is and what it sells, choose a voice and a model, switch on booking or transfer. Test it on your own phone.',
  },
  {
    icon: Rocket,
    title: 'Launch a campaign',
    body: 'Upload a contact list, set calling hours and press start. Summaries, outcomes and bookings appear as calls finish.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface py-section">
      <div className="container">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-h1">Live in an afternoon</h2>
          <p className="mt-3 text-lead text-muted">
            Three setup steps once you have paid. No hardware, no number porting, no developers.
          </p>
        </Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 120} className="h-full">
                <Spotlight className="h-full rounded-lg">
                  <div className="relative h-full rounded-lg border border-line bg-canvas p-7">
                    <span className="num text-sm font-bold text-brand-600">0{i + 1}</span>
                    <span className="absolute right-6 top-6 flex h-11 w-11 animate-tick items-center justify-center rounded-full bg-ink text-white">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <h3 className="mt-10 text-h3">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                  </div>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
