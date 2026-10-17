import { cn } from '@/lib/cn';

type Cloud = {
  tone: 'pink' | 'sage' | 'white';
  /** Position and width, in percent of the scene. */
  left: number;
  bottom: number;
  width: number;
  /** Drift distance (px), duration (s), delay (s) and scroll rise (px). */
  dx: number;
  dur: number;
  delay: number;
  rise: number;
};

// Back to front: far clouds frame the sun, near ones bank up around the trail.
const CLOUDS: Cloud[] = [
  { tone: 'sage', left: -6, bottom: 20, width: 34, dx: 18, dur: 18, delay: 0, rise: 30 },
  { tone: 'pink', left: 70, bottom: 26, width: 36, dx: 22, dur: 20, delay: -6, rise: 36 },
  { tone: 'pink', left: 8, bottom: 2, width: 40, dx: 26, dur: 16, delay: -3, rise: 70 },
  { tone: 'sage', left: 58, bottom: -2, width: 46, dx: 20, dur: 17, delay: -9, rise: 80 },
  { tone: 'white', left: 24, bottom: -10, width: 30, dx: 14, dur: 13, delay: -2, rise: 110 },
  { tone: 'white', left: 46, bottom: -12, width: 28, dx: 16, dur: 15, delay: -7, rise: 120 },
];

/**
 * The Minimal theme's scene: a coral sun rising through pastel clouds with a
 * rocket's vapour trail climbing into it. Pure CSS and three tiny SVGs; all
 * motion is in themes/minimal.css and stops under reduced motion. `hero`
 * adds scroll parallax (the sun sinks, the clouds rise).
 */
export function SunScene({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  return (
    <div className={cn('sun-scene', variant === 'hero' && 'sun-scene--hero')} aria-hidden="true">
      <div className="sun-scene__sun" />
      <div className="sun-scene__trail" />
      {CLOUDS.map((c, i) => (
        <span
          key={i}
          className={`sun-cloud sun-cloud--${c.tone}`}
          style={
            {
              left: `${c.left}%`,
              bottom: `${c.bottom}%`,
              width: `${c.width}%`,
              '--dx': `${c.dx}px`,
              '--dur': `${c.dur}s`,
              '--delay': `${c.delay}s`,
              '--rise': `${c.rise}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
