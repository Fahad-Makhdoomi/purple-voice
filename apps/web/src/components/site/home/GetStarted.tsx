import Link from 'next/link';
import { Bot, CreditCard, Rocket, UserPlus } from 'lucide-react';
import { Reveal } from '@/components/site/motion';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Pick a plan and create your account',
    body: 'Choose Basic or Pro below. Sign up with your email or Google — it takes under a minute.',
    time: '1 min',
  },
  {
    icon: CreditCard,
    title: 'Pay securely with Razorpay',
    body: 'A payment window opens right in the app. Pay by UPI, RuPay, Visa, Mastercard or net banking. Your plan switches on the moment it is confirmed.',
    time: '2 min',
  },
  {
    icon: Bot,
    title: 'Connect a number, build your agent',
    body: 'Add your Twilio, Plivo or SuperPhone number, write what your agent should say, and test it on your own phone.',
    time: '10 min',
  },
  {
    icon: Rocket,
    title: 'Launch your first campaign',
    body: 'Upload a contact list, set calling hours and press start. Booked meetings and call summaries appear as calls finish.',
    time: 'Same day',
  },
];

/** The route from landing page to first call, with an animated progress line. */
export function GetStarted() {
  return (
    <section
      id="get-started"
      className="relative isolate scroll-mt-20 overflow-hidden bg-night py-section text-white"
      aria-labelledby="start-title"
    >
      <div className="dot-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="absolute bottom-0 left-1/2 -z-10 h-[360px] w-[760px] -translate-x-1/2 translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--pv-violet-500)/0.5),transparent)]"
        aria-hidden="true"
      />
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-brand-300">Getting started</p>
          <h2 id="start-title" className="mt-3 text-h1 text-white">
            From checkout to your first call, today
          </h2>
          <p className="mt-4 text-lead text-white/65">
            No sales call, no contract and no setup fee. Four steps, and the first two take about
            three minutes.
          </p>
        </Reveal>

        <ol className="relative mt-14 grid gap-5 lg:grid-cols-4">
          <div
            className="absolute left-[12.5%] right-[12.5%] top-[34px] hidden h-px lg:block"
            aria-hidden="true"
          >
            <div className="h-full w-full animate-shimmer bg-[linear-gradient(90deg,rgb(255_255_255/0.08)_0%,rgb(var(--pv-violet-400))_25%,rgb(var(--pv-cyan-300))_50%,rgb(255_255_255/0.08)_75%)] [background-size:200%_100%]" />
          </div>
          {STEPS.map(({ icon: Icon, title, body, time }, i) => (
            <li key={title}>
              <Reveal delay={i * 120}>
                <div className="glass relative h-full p-6 pt-14 text-center">
                  <span className="absolute left-1/2 top-0 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-night ring-1 ring-brand-400/50">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand shadow-glow">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="num absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-800">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="text-[16px] font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
                  <p className="mt-4 inline-block rounded-pill bg-white/[0.07] px-3 py-1 text-xs font-semibold text-brand-200">
                    {time}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal
          className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row"
          delay={200}
        >
          <Link href="/signup?plan=BASIC" className="btn btn-magic btn-lg min-w-[230px]">
            Start with Basic — $19 / month
          </Link>
          <Link href="/signup?plan=PRO" className="btn btn-glass btn-lg min-w-[200px]">
            Go straight to Pro
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
