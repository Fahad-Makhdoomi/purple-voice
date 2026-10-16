'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, PhoneIncoming } from 'lucide-react';
import { PointerStage, Waveform } from '@/components/site/motion';

/** Depth layer: drifts with the pointer by `depth` px. */
const layer = (depth: number) => ({
  transform: `translate3d(calc(var(--px) * ${depth}px), calc(var(--py) * ${depth}px), 0)`,
  transition: 'transform 300ms var(--pv-ease)',
});

const BARS = [30, 45, 38, 60, 52, 78, 95];

/** The hero's living illustration. Numbers are a sample dashboard, not live data. */
export function HeroStage() {
  const [calls, setCalls] = useState(1284);
  const [bars, setBars] = useState(BARS);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => {
      setCalls((c) => c + 1 + Math.floor(Math.random() * 3));
      setBars((b) => [...b.slice(1), 35 + Math.floor(Math.random() * 62)]);
    }, 2200);
    return () => window.clearInterval(t);
  }, []);

  return (
    <PointerStage className="container relative mt-14 sm:mt-20">
      <div className="relative mx-auto h-[340px] max-w-[980px] sm:h-[470px]" aria-hidden="true">
        {/* Glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2"
          style={layer(-10)}
        >
          <div className="h-full w-full animate-pulse rounded-full bg-[radial-gradient(circle,rgb(var(--pv-violet-500)/0.55),transparent_62%)]" />
        </div>

        {/* Sound rings */}
        <div className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 sm:h-[310px] sm:w-[310px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute inset-0 animate-ring rounded-full border border-brand-300/50"
              style={{ animationDelay: `${i * 1.05}s` }}
            />
          ))}
        </div>

        {/* Orb */}
        <svg
          viewBox="0 0 300 300"
          className="absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 sm:h-[300px] sm:w-[300px]"
          style={layer(8)}
        >
          <defs>
            <radialGradient id="hero-orb" cx="40%" cy="32%" r="70%">
              <stop offset="0%" stopColor="rgb(var(--pv-violet-200))" />
              <stop offset="35%" stopColor="rgb(var(--pv-violet-500))" />
              <stop offset="80%" stopColor="rgb(var(--pv-violet-800))" />
              <stop offset="100%" stopColor="rgb(var(--pv-violet-950))" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="150" r="120" fill="url(#hero-orb)" />
          <g fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="1">
            <ellipse cx="150" cy="150" rx="40" ry="120" />
            <ellipse cx="150" cy="150" rx="80" ry="120" />
            <ellipse cx="150" cy="150" rx="120" ry="40" />
            <ellipse cx="150" cy="150" rx="120" ry="80" />
            <line x1="150" y1="30" x2="150" y2="270" />
          </g>
          <g className="origin-center animate-orbit [transform-box:fill-box]">
            <ellipse
              cx="150"
              cy="150"
              rx="148"
              ry="46"
              fill="none"
              stroke="rgb(var(--pv-violet-300))"
              strokeOpacity="0.6"
              transform="rotate(-18 150 150)"
            />
            <circle cx="298" cy="150" r="5" fill="rgb(var(--pv-cyan-300))" />
          </g>
          <circle cx="112" cy="104" r="34" fill="white" opacity="0.12" />
        </svg>

        {/* Voice bars across the orb */}
        <div
          className="absolute left-1/2 top-1/2 h-12 w-[150px] -translate-x-1/2 -translate-y-1/2 sm:h-14 sm:w-[190px]"
          style={layer(14)}
        >
          <Waveform bars={26} />
        </div>

        {/* Floating glass cards */}
        <div className="absolute left-0 top-2 hidden sm:block" style={layer(22)}>
          <div className="glass w-56 animate-float p-4 text-left">
            <p className="text-xs text-white/55">Calls today</p>
            <p className="num mt-1 text-2xl font-semibold">{calls.toLocaleString('en-US')}</p>
            <div className="mt-3 flex h-12 items-end gap-1.5">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-brand-700 to-brand-300 transition-[height] duration-700"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-6 hidden sm:block" style={layer(-18)}>
          <div className="glass w-60 animate-float p-4 text-left [animation-delay:1.5s]">
            <div className="flex items-center gap-2 text-xs text-white/55">
              <CalendarCheck size={14} /> Appointment booked
              <span className="ml-auto h-2 w-2 animate-tick rounded-full bg-emerald-400" />
            </div>
            <p className="mt-2 text-sm font-semibold">Tue, 10:30 — Solar consult</p>
            <p className="mt-1 text-xs text-white/50">Dana R. · invite sent</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-[6%] hidden sm:block" style={layer(-26)}>
          <div className="glass w-64 animate-float p-4 text-left [animation-delay:3s]">
            <div className="flex items-center gap-2 text-xs text-white/55">
              <PhoneIncoming size={14} /> Live transcript
            </div>
            <p className="mt-2 rounded-sm bg-white/[0.07] px-3 py-2 text-xs text-white/80">
              “Can we do Tuesday morning?”
            </p>
            <p className="mt-1.5 rounded-sm bg-brand-500/30 px-3 py-2 text-xs text-white">
              “Tuesday at 10:30 is open. Shall I book it?”
            </p>
          </div>
        </div>

        <div className="absolute bottom-4 right-[4%] hidden sm:block" style={layer(16)}>
          <div className="glass w-56 animate-float p-4 text-left [animation-delay:2.2s]">
            <span className="rounded-pill border border-white/15 bg-white/10 px-2.5 py-1 text-[11px]">
              Pipeline: $16,900
            </span>
            <svg viewBox="0 0 200 70" className="mt-3 h-14 w-full">
              <defs>
                <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--pv-violet-300))" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="rgb(var(--pv-violet-700))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 62 L30 55 L60 58 L90 40 L120 44 L150 24 L180 18 L200 4 L200 70 L0 70Z"
                fill="url(#hero-area)"
              />
              <path
                d="M0 62 L30 55 L60 58 L90 40 L120 44 L150 24 L180 18 L200 4"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1}
                className="animate-dash"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* On phones the floating cards collapse into a simple stat row. */}
      <dl className="mx-auto grid max-w-sm grid-cols-3 gap-3 text-center sm:hidden">
        {[
          ['1,284', 'calls today'],
          ['0.4s', 'to answer'],
          ['31%', 'booked'],
        ].map(([value, label]) => (
          <div key={label} className="glass px-2 py-3">
            <dt className="sr-only">{label}</dt>
            <dd className="num text-lg font-semibold text-white">{value}</dd>
            <dd className="text-[11px] text-white/55">{label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-center text-[11px] text-white/35">
        Sample dashboard, for illustration
      </p>
    </PointerStage>
  );
}
