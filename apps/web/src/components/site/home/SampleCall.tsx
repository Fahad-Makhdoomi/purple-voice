'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PLAY_SAMPLE_EVENT, SAMPLE_CALL } from './sample-call';

const call = SAMPLE_CALL;
/** 60 bars (the louder of each pair of slices): enough detail, still legible on a phone. */
const BARS = call.peaks
  .filter((_, i) => i % 2 === 0)
  .map((p, i) => Math.max(p, call.peaks[i * 2 + 1] ?? 0));

function clock(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Index of the line being spoken at `t`, or of the last one already spoken. */
function lineAt(t: number) {
  let idx = -1;
  for (let i = 0; i < call.lines.length; i++) if (t >= call.lines[i]!.start - 0.05) idx = i;
  return idx;
}

/**
 * A recorded call, shown the way the Calls tab shows one: who called whom,
 * the recording with its waveform, and the transcript, which follows the
 * audio and can be clicked to jump to a line.
 */
export function SampleCall({ className }: { className?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);

  // Follow the audio every frame while it plays (timeupdate is too coarse for the waveform).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const play = useCallback(async () => {
    const a = audio.current;
    if (!a) return;
    if (a.ended || a.currentTime >= call.duration - 0.05) a.currentTime = 0;
    setStarted(true);
    try {
      await a.play();
    } catch {
      /* Autoplay refused: the button is still there to press. */
    }
  }, []);

  const seek = useCallback(
    (t: number) => {
      const a = audio.current;
      if (!a) return;
      a.currentTime = Math.min(Math.max(0, t), call.duration);
      setTime(a.currentTime);
      if (!playing) void play();
    },
    [playing, play],
  );

  // "Hear a sample call" elsewhere on the page scrolls here and starts it.
  useEffect(() => {
    const onPlay = () => {
      root.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      void play();
    };
    const onHash = () => {
      if (window.location.hash === '#listen') onPlay();
    };
    window.addEventListener(PLAY_SAMPLE_EVENT, onPlay);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(PLAY_SAMPLE_EVENT, onPlay);
      window.removeEventListener('hashchange', onHash);
    };
  }, [play]);

  const active = lineAt(time);
  const speaking = active >= 0 && time <= call.lines[active]!.end + 0.05 ? active : -1;
  const ended = started && !playing && time >= call.duration - 0.3;

  // Keep the spoken line in view inside the transcript, without moving the page.
  useEffect(() => {
    const ol = list.current;
    const li = ol?.children[active] as HTMLElement | undefined;
    if (!ol || !li || !started) return;
    const top = li.offsetTop - ol.offsetTop;
    if (top < ol.scrollTop || top + li.offsetHeight > ol.scrollTop + ol.clientHeight) {
      ol.scrollTo({ top: top - 12, behavior: 'smooth' });
    }
  }, [active, started]);

  const status = !started
    ? 'Recorded call'
    : ended
      ? 'Call ended'
      : time < call.answeredAt
        ? 'Ringing…'
        : speaking >= 0
          ? `${call.lines[speaking]!.who === 'ai' ? call.agent.name : 'Dana'} is speaking`
          : 'Connected';

  const progress = time / call.duration;

  return (
    <div
      ref={root}
      className={cn('glass-dark overflow-hidden rounded-[22px] text-left text-white', className)}
    >
      <audio
        ref={audio}
        src={call.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(call.duration);
        }}
      />

      {/* Who called whom. */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[13px] font-semibold text-white">
          AV
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {call.agent.name} <span className="font-normal text-white/45">to</span> {call.lead.name}
          </p>
          <p className="truncate text-xs text-white/50">
            Outbound · {call.agent.company} · {call.lead.phone}
          </p>
        </div>
        <span className="hidden shrink-0 rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-white/55 sm:block">
          {clock(call.duration)}
        </span>
      </div>

      {/* The recording. */}
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => (playing ? audio.current?.pause() : void play())}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_24px_-8px_rgb(var(--pv-violet-600))] transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300/50"
            aria-label={playing ? 'Pause the call recording' : 'Play the call recording'}
          >
            {playing ? (
              <Pause size={20} fill="currentColor" />
            ) : ended ? (
              <RotateCcw size={19} />
            ) : (
              <Play size={20} fill="currentColor" className="translate-x-[1px]" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div
              role="slider"
              tabIndex={0}
              aria-label="Position in the call recording"
              aria-valuemin={0}
              aria-valuemax={Math.round(call.duration)}
              aria-valuenow={Math.round(time)}
              aria-valuetext={`${clock(time)} of ${clock(call.duration)}`}
              className="flex h-10 cursor-pointer items-center gap-px text-white sm:gap-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/60"
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * call.duration);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') seek(time + 5);
                else if (e.key === 'ArrowLeft') seek(time - 5);
                else return;
                e.preventDefault();
              }}
            >
              {BARS.map((p, i) => {
                const at = i / BARS.length;
                const ringing = (at + 0.5 / BARS.length) * call.duration < call.answeredAt;
                return (
                  <span
                    key={i}
                    className={cn(
                      'block flex-1 rounded-full transition-colors duration-150',
                      at < progress
                        ? 'bg-brand-500'
                        : ringing
                          ? 'bg-current opacity-15'
                          : 'bg-current opacity-30',
                    )}
                    style={{ height: `${Math.max(8, Math.min(100, p * 100))}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-white/55">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    playing && time >= call.answeredAt
                      ? 'bg-emerald-500'
                      : playing
                        ? 'bg-amber-400'
                        : 'bg-current opacity-40',
                  )}
                  aria-hidden="true"
                />
                <span aria-live="polite">{status}</span>
              </span>
              <span className="font-mono text-white/45">
                {clock(time)} / {clock(call.duration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript, following the audio. */}
      <ol
        ref={list}
        className="relative max-h-[300px] space-y-1 overflow-y-auto border-t border-white/10 px-3 py-3 [scrollbar-width:thin]"
        aria-label="Call transcript"
      >
        {call.lines.map((l, i) => {
          const past = started && i < active;
          const now = started && i === speaking;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => seek(l.start)}
                className={cn(
                  'grid w-full grid-cols-[42px_1fr] gap-x-2 rounded-xl px-2 py-2 text-left transition-colors duration-300',
                  now ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                  started && !now && !past && 'opacity-45',
                )}
              >
                <span className="pt-[3px] font-mono text-[11px] text-white/40">
                  {clock(l.start)}
                </span>
                <span>
                  <span
                    className={cn(
                      'block text-[11px] font-semibold uppercase tracking-[0.08em]',
                      l.who === 'ai' ? 'text-brand-300' : 'text-white/55',
                    )}
                  >
                    {l.who === 'ai' ? `${call.agent.name} · AI agent` : 'Dana'}
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-white/85">
                    {l.text}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* What the agent did with the call. */}
      <div
        className={cn(
          'flex items-start gap-3 border-t border-white/10 px-5 py-4 transition-colors duration-500',
          ended && 'bg-emerald-400/10',
        )}
      >
        <CalendarCheck
          size={18}
          className={cn('mt-0.5 shrink-0', ended ? 'text-emerald-400' : 'text-white/45')}
          aria-hidden="true"
        />
        <p className="text-sm">
          <span className="font-semibold text-white">{call.outcome.title}</span>
          <span className="block text-white/55">{call.outcome.detail}</span>
        </p>
      </div>
    </div>
  );
}

/** A button that scrolls to the sample call and plays it. */
export function PlaySampleButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(PLAY_SAMPLE_EVENT))}
    >
      {children}
    </button>
  );
}
