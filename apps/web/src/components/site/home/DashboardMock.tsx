'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  CalendarCheck,
  Megaphone,
  PhoneCall,
  Phone,
  Settings,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { icon: BarChart3, label: 'Overview', active: true },
  { icon: Bot, label: 'Agents' },
  { icon: Megaphone, label: 'Campaigns' },
  { icon: PhoneCall, label: 'Calls' },
  { icon: CalendarCheck, label: 'Appointments' },
  { icon: Phone, label: 'Numbers' },
];

const CALLS = [
  ['Dana R.', 'Solar consult', 'Booked', 'text-emerald-300 bg-emerald-400/10'],
  ['Marcus T.', 'Roof inspection', 'Transferred', 'text-sky-300 bg-sky-400/10'],
  ['Priya S.', 'Follow-up quote', 'Interested', 'text-violet-300 bg-violet-400/10'],
  ['Luis G.', 'Financing question', 'Call back', 'text-amber-300 bg-amber-400/10'],
];

const LINE_A =
  'M0 120 C40 110 60 60 100 70 S160 130 200 100 S270 40 310 60 S380 110 420 80 S480 30 520 50';
const LINE_B =
  'M0 140 C50 120 70 130 110 105 S170 80 210 95 S280 120 320 90 S390 60 430 75 S490 85 520 70';

function Gauge({ value, label }: { value: number; label: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="rgb(var(--pv-violet-300))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-[1600ms] ease-out"
        />
      </svg>
      <div>
        <p className="num text-lg font-semibold leading-none text-white">{value}%</p>
        <p className="mt-1 text-[11px] text-white/45">{label}</p>
      </div>
    </div>
  );
}

/**
 * A window onto the product: the real dashboard's building blocks (stat
 * tiles, chart, call list, gauges) in a frame that starts tilted back and
 * levels out as it scrolls into view. Figures are a sample.
 */
export function DashboardMock() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setT(1);
      setDrawn(true);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the frame's top edge enters the bottom of the screen, 1 once it is 35% from the top.
      const p = (vh - r.top) / (vh * 0.65);
      const clamped = Math.min(1, Math.max(0, p));
      setT(clamped);
      if (clamped > 0.35) setDrawn(true);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const ease = 1 - Math.pow(1 - t, 3);

  return (
    <div className="[perspective:1600px]" aria-hidden="true">
      <div
        ref={ref}
        className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-[0_40px_120px_-30px_rgb(98_54_240/0.55)] backdrop-blur-2xl backdrop-saturate-150"
        style={{
          transform: `rotateX(${(1 - ease) * 26}deg) translateY(${(1 - ease) * 40}px) scale(${0.9 + ease * 0.1})`,
          transformOrigin: '50% 0%',
          opacity: 0.35 + ease * 0.65,
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-3 rounded-pill bg-white/[0.06] px-3 py-0.5 text-[10px] text-white/40">
            voice.purplerocket.co/dashboard
          </span>
        </div>
        <div className="grid sm:grid-cols-[170px_1fr]">
          <nav className="hidden border-r border-white/10 p-4 sm:block">
            <ul className="space-y-1">
              {NAV.map(({ icon: Icon, label, active }) => (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-pill px-3 py-2 text-xs font-medium',
                    active ? 'bg-white text-ink' : 'text-white/55',
                  )}
                >
                  <Icon size={14} /> {label}
                </li>
              ))}
            </ul>
            <ul className="mt-8 space-y-1 text-xs text-white/40">
              <li className="flex items-center gap-2.5 px-3 py-2">
                <Settings size={14} /> Settings
              </li>
              <li className="flex items-center gap-2.5 px-3 py-2">
                <LifeBuoy size={14} /> Support
              </li>
            </ul>
          </nav>

          <div className="space-y-3 p-4 text-left sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Calls today', '1,284', '+12%'],
                ['Connect rate', '73%', '+4%'],
                ['Meetings booked', '186', '+21%'],
                ['Minutes used', '612 / 1,000', ''],
              ].map(([label, value, delta]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
                >
                  <p className="text-[11px] text-white/45">{label}</p>
                  <p className="num mt-1 text-xl font-light text-white">{value}</p>
                  {delta && (
                    <p className="mt-0.5 text-[10px] font-semibold text-emerald-300">{delta}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">Calls and meetings</p>
                  <p className="flex items-center gap-3 text-[10px] text-white/45">
                    <span className="flex items-center gap-1">
                      <i className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Calls
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Meetings
                    </span>
                  </p>
                </div>
                <svg viewBox="0 0 520 160" className="mt-3 h-32 w-full">
                  <defs>
                    <linearGradient id="dm-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--pv-violet-400))" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="rgb(var(--pv-violet-400))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[40, 80, 120].map((y) => (
                    <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="rgb(255 255 255 / 0.06)" />
                  ))}
                  <path
                    d={`${LINE_A} L520 160 L0 160Z`}
                    fill="url(#dm-area)"
                    opacity={drawn ? 1 : 0}
                    className="transition-opacity duration-1000"
                  />
                  <path
                    d={LINE_A}
                    fill="none"
                    stroke="rgb(var(--pv-violet-400))"
                    strokeWidth="2.5"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={drawn ? 0 : 1}
                    style={{ transition: 'stroke-dashoffset 2200ms cubic-bezier(.16,1,.3,1)' }}
                  />
                  <path
                    d={LINE_B}
                    fill="none"
                    stroke="rgb(var(--pv-cyan-300))"
                    strokeWidth="2.5"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={drawn ? 0 : 1}
                    style={{
                      transition: 'stroke-dashoffset 2600ms cubic-bezier(.16,1,.3,1) 200ms',
                    }}
                  />
                </svg>
              </div>
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Gauge value={drawn ? 73 : 0} label="Connect rate" />
                <Gauge value={drawn ? 31 : 0} label="Booked" />
                <Gauge value={drawn ? 58 : 0} label="Qualified" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2">
              {CALLS.map(([name, topic, status, tone]) => (
                <div key={name} className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white">
                    {name!.slice(0, 1)}
                  </span>
                  <span className="font-semibold text-white">{name}</span>
                  <span className="hidden text-white/45 sm:inline">{topic}</span>
                  <span
                    className={cn(
                      'ml-auto rounded-pill px-2.5 py-0.5 text-[10px] font-semibold',
                      tone,
                    )}
                  >
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-white/30">Sample data, for illustration</p>
    </div>
  );
}
