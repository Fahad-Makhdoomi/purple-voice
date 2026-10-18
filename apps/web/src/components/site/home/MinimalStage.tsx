import { CalendarCheck, MessageSquareText, PhoneIncoming, Sparkles } from 'lucide-react';
import { SunScene } from '@/components/site/SunScene';
import { PointerStage } from '@/components/site/motion';

/**
 * Minimal's hero stage: the violet sun with sound-wave ripples and slow light
 * rays, and live-call chips floating around it at different depths, drifting
 * with the pointer (PointerStage publishes --px / --py). Pure CSS motion in
 * themes/minimal.css; nothing moves under reduced motion.
 */
const CHIPS = [
  {
    icon: PhoneIncoming,
    title: 'Calling Dana R.',
    meta: 'Solar consult · 0:42',
    pos: 'left-[4%] top-[18%] sm:left-[10%]',
    depth: 18,
    delay: 1.6,
    tone: 'bg-emerald-400/15 text-emerald-600',
  },
  {
    icon: CalendarCheck,
    title: 'Meeting booked',
    meta: 'Tue 10:30 · invite sent',
    pos: 'right-[4%] top-[10%] sm:right-[11%]',
    depth: 30,
    delay: 2.1,
    tone: 'bg-brand-500/15 text-brand-700',
  },
  {
    icon: MessageSquareText,
    title: 'Price list sent',
    meta: 'On WhatsApp, during the call',
    pos: 'left-[14%] bottom-[30%] hidden sm:flex',
    depth: 40,
    delay: 2.6,
    tone: 'bg-sky-400/15 text-sky-700',
  },
  {
    icon: Sparkles,
    title: 'Lead scored “Hot”',
    meta: 'Summary saved to CRM',
    pos: 'right-[13%] bottom-[34%] hidden sm:flex',
    depth: 24,
    delay: 3.1,
    tone: 'bg-amber-400/20 text-amber-700',
  },
];

export function MinimalStage({ children }: { children?: React.ReactNode }) {
  return (
    <PointerStage className="minimal-stage absolute inset-0">
      <SunScene />
      <div className="minimal-glow" aria-hidden="true" />
      <ul className="pointer-events-none absolute inset-0" aria-hidden="true">
        {CHIPS.map((c) => (
          <li
            key={c.title}
            className={`call-chip absolute flex items-center gap-2.5 ${c.pos}`}
            style={
              {
                '--depth': c.depth,
                '--chip-delay': `${c.delay}s`,
              } as React.CSSProperties
            }
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${c.tone}`}>
              <c.icon size={15} />
            </span>
            <span className="text-left">
              <span className="block text-[12.5px] font-semibold text-ink">{c.title}</span>
              <span className="block text-[11px] text-muted">{c.meta}</span>
            </span>
          </li>
        ))}
      </ul>
      {children}
    </PointerStage>
  );
}
