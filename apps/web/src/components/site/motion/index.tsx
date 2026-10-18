'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** True when the visitor asked the OS for less motion. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Fires once, the first time `ref` scrolls into view. */
function useInView<T extends Element>(threshold = 0.18) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Fades and slides its children in when they scroll into view. */
export function Reveal({
  as,
  delay = 0,
  variant = 'up',
  className,
  children,
}: {
  as?: ElementType;
  delay?: number;
  variant?: 'up' | 'left' | 'right' | 'zoom' | 'blur' | 'fade';
  className?: string;
  children: ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  const Tag = (as ?? 'div') as ElementType;
  return (
    <Tag
      ref={ref}
      data-variant={variant}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
      className={cn('reveal', seen && 'is-in', className)}
    >
      {children}
    </Tag>
  );
}

/** Counts up to `value` the first time it is seen. Renders the final number without JS. */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  duration = 1600,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.4);
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!seen || prefersReducedMotion()) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className={cn('num', className)}>
      {prefix}
      {n.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

/** A card whose glow follows the pointer and which lifts on hover. */
export function Spotlight({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn('spotlight', className)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** Thin violet bar at the top of the page that fills as you scroll. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
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
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" aria-hidden="true">
      <div
        ref={bar}
        className="h-full origin-left bg-gradient-to-r from-brand-400 via-periwinkle-300 to-cyan-300"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

/**
 * Wraps the hero stage and publishes the pointer position as --px / --py
 * (-1…1), so layers inside can drift at different depths.
 */
export function PointerStage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div ref={ref} className={className} style={{ '--px': 0, '--py': 0 } as CSSProperties}>
      {children}
    </div>
  );
}

/** Equaliser bars. `active` makes them move; otherwise they rest flat. */
export function Waveform({
  bars = 24,
  className,
  active = true,
}: {
  bars?: number;
  className?: string;
  active?: boolean;
}) {
  return (
    <span className={cn('flex h-full items-center gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-full w-[3px] origin-center rounded-full bg-gradient-to-t from-brand-500 to-cyan-300',
            active ? 'animate-wave' : 'scale-y-[0.2]',
          )}
          style={{
            animationDelay: `${((i * 137) % 900) * -1}ms`,
            animationDuration: `${800 + ((i * 53) % 700)}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** Types `text` out one character at a time, then calls `onDone`. */
function Typed({
  text,
  onDone,
  speed = 22,
}: {
  text: string;
  onDone?: () => void;
  speed?: number;
}) {
  const [n, setN] = useState(prefersReducedMotion() ? text.length : 0);
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const t = window.setTimeout(() => setN((v) => v + 1), speed);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, text]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && (
        <span className="ml-0.5 inline-block h-3 w-[2px] animate-blink bg-current align-middle" />
      )}
    </>
  );
}

interface Line {
  who: 'ai' | 'lead';
  text: string;
}

/**
 * A scripted sales call that plays when scrolled into view: lines type out,
 * the waveform follows whoever is speaking, and the outcome card pops in at
 * the end. Then it waits a moment and plays again.
 */
export function LiveCall({ script, className }: { script: Line[]; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const done = shown >= script.length;
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = prefersReducedMotion();
    if (reduce.current) setShown(script.length);
  }, [script.length]);

  // Start each line after a short pause (the "thinking" beat).
  useEffect(() => {
    if (!seen || reduce.current || done || typing) return;
    const t = window.setTimeout(() => setTyping(true), shown === 0 ? 500 : 650);
    return () => window.clearTimeout(t);
  }, [seen, shown, typing, done]);

  // Replay once the outcome has been on screen for a while.
  useEffect(() => {
    if (!done || reduce.current) return;
    const t = window.setTimeout(() => {
      setShown(0);
      setTyping(false);
    }, 7000);
    return () => window.clearTimeout(t);
  }, [done]);

  const speaker = typing ? script[shown]?.who : undefined;

  return (
    <div ref={ref} className={cn('glass overflow-hidden p-0', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold">
            <span className="absolute inset-0 animate-ring rounded-full border border-brand-300" />
            AV
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Ava · Purple Voice agent</p>
            <p className="text-xs text-white/50">Calling Dana R. · +1 (415) ••• 0142</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-pill bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 animate-tick rounded-full bg-emerald-400" /> Live
        </span>
      </div>

      <div className="h-9 border-b border-white/5 px-5 py-2">
        <Waveform bars={42} active={!!speaker} />
      </div>

      <ol
        className="min-h-[300px] space-y-2.5 px-5 py-5 text-left"
        aria-label="Sample call transcript"
      >
        {script.slice(0, shown).map((l, i) => (
          <li
            key={i}
            className={cn(
              'max-w-[86%] animate-pop rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              l.who === 'ai'
                ? 'rounded-bl-sm bg-brand-500/30 text-white'
                : 'ml-auto rounded-br-sm bg-white/[0.08] text-white/85',
            )}
          >
            {l.text}
          </li>
        ))}
        {typing && script[shown] && (
          <li
            className={cn(
              'max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              script[shown]!.who === 'ai'
                ? 'rounded-bl-sm bg-brand-500/30 text-white'
                : 'ml-auto rounded-br-sm bg-white/[0.08] text-white/85',
            )}
          >
            <Typed
              text={script[shown]!.text}
              onDone={() => {
                setShown((v) => v + 1);
                setTyping(false);
              }}
            />
          </li>
        )}
        {done && (
          <li className="animate-pop rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <p className="font-semibold">Outcome · Meeting booked</p>
            <p className="mt-0.5 text-emerald-100/70">
              Tue 10:30 · invite sent · summary saved · lead scored “Hot”
            </p>
          </li>
        )}
      </ol>
    </div>
  );
}
