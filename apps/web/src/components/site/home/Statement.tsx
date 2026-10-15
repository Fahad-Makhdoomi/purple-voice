import {
  Bot,
  CalendarCheck,
  Megaphone,
  PhoneCall,
  Sparkles,
  Workflow,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ORBIT: Array<{ icon: LucideIcon; tone: 'deep' | 'soft' | 'pink' }> = [
  { icon: PhoneCall, tone: 'deep' },
  { icon: CalendarCheck, tone: 'pink' },
  { icon: Webhook, tone: 'soft' },
  { icon: Megaphone, tone: 'soft' },
  { icon: Workflow, tone: 'deep' },
  { icon: Bot, tone: 'pink' },
];

const TONES = {
  deep: 'bg-brand-800 text-white',
  soft: 'bg-white/80 text-brand-600',
  pink: 'bg-pink-100 text-brand-700',
};

/**
 * The pastel statement band: light words, one heavy word, and the product's
 * capabilities orbiting a glowing spark between them.
 */
export function Statement() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-wash py-section">
      <div className="container grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
        <p className="text-center text-h2 font-light text-brand-700/80 lg:text-right">
          Every lead expects a call back. Most teams don&apos;t have the
        </p>

        <div className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72" aria-hidden="true">
          <div className="absolute inset-6 rounded-full border-[14px] border-brand-500/25 shadow-[0_0_60px_10px_rgb(var(--pv-violet-400)/0.35)]" />
          <div className="absolute inset-0 animate-orbit">
            {ORBIT.map(({ icon: Icon, tone }, i) => {
              const angle = (i / ORBIT.length) * 2 * Math.PI - Math.PI / 2;
              const x = 50 + 44 * Math.cos(angle);
              const y = 50 + 44 * Math.sin(angle);
              return (
                <span
                  key={i}
                  className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow ring-4 ring-white/50 ${TONES[tone]}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span className="animate-orbit-reverse">
                    <Icon size={20} />
                  </span>
                </span>
              );
            })}
          </div>
          <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(var(--pv-violet-400)),rgb(var(--pv-violet-800))_70%)] text-white shadow-glow">
            <Sparkles size={36} />
          </div>
        </div>

        <p className="text-center text-h1 font-extrabold text-brand-950 lg:text-left">time.</p>
      </div>
      <p className="container mt-10 max-w-2xl text-center text-lead text-ink-soft">
        Purple Voice gives every lead a conversation within minutes — qualifying, answering and
        booking — and hands your team only the calls worth their time.
      </p>
    </section>
  );
}
