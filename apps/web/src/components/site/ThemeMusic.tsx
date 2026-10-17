'use client';

import { useRef, useState } from 'react';
import { Music2, Pause } from 'lucide-react';

/**
 * A small play/pause pill for a theme's background music. It never starts on
 * its own: browsers block autoplay with sound, and visitors shouldn't be
 * surprised by it. Playing continues across page navigations because the
 * site layout (and so this component) stays mounted.
 */
export function ThemeMusic({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);

  async function toggle() {
    const el = audio.current;
    if (!el) return;
    if (!el.paused) return el.pause();
    el.volume = 0.35;
    // Rejected when the browser refuses playback; the button simply stays on "Music".
    await el.play().catch(() => undefined);
  }

  if (broken) return null;

  return (
    <>
      {/* The button follows the element's own events, so pauses from outside the
          page (media keys, a phone's lock screen) keep the label honest. */}
      <audio
        ref={audio}
        src={src}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setBroken(true)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Pause background music' : 'Play background music'}
        className="theme-music fixed bottom-5 left-5 z-40 inline-flex h-11 items-center gap-2 rounded-pill border border-white bg-white/80 pl-3 pr-4 text-[13px] font-bold text-brand-700 shadow-lg backdrop-blur-md transition hover:bg-white"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-white">
          {playing ? <Pause size={14} aria-hidden="true" /> : <Music2 size={14} aria-hidden="true" />}
        </span>
        <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`theme-music-bar w-[3px] rounded-pill bg-brand-400 ${playing ? 'is-playing' : ''}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        {playing ? 'Music on' : 'Music'}
      </button>
    </>
  );
}
