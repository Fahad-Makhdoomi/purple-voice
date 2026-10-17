import { KeyRound, Lock, PlugZap, ShieldCheck } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';

const ITEMS = [
  {
    icon: Lock,
    title: 'Secrets encrypted at rest',
    body: 'AI keys, carrier tokens and payment credentials are stored with AES-256-GCM and never shown again.',
  },
  {
    icon: ShieldCheck,
    title: 'Signed callbacks and webhooks',
    body: 'Carrier callbacks and your webhooks carry HMAC signatures, so a forged request is rejected.',
  },
  {
    icon: PlugZap,
    title: 'Your numbers, your AI',
    body: 'Calls run on the phone numbers you already own, and every credential stays encrypted and under your control.',
  },
  {
    icon: KeyRound,
    title: 'Pay without sharing card data',
    body: 'Checkout runs on Razorpay. Your UPI or card details go to Razorpay and never touch our servers.',
  },
];

/** What keeps the product safe, in four black glass cards. */
export function Trust() {
  return (
    <section className="py-section" aria-labelledby="trust-title">
      <div className="container">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="trust-title"
            className="text-[length:clamp(34px,5vw,64px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
          >
            Built to be trusted with your customers.
          </h2>
          <p className="mt-5 text-lead text-white/65">
            An agent that speaks for your business needs real safeguards. These are the ones in the
            product today.
          </p>
        </Reveal>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 90} className="h-full">
                <Spotlight className="glass-dark group h-full p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink transition duration-500 group-hover:scale-110">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-10 text-[20px] font-medium leading-snug tracking-[-0.02em] text-white">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/55">{body}</p>
                </Spotlight>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
