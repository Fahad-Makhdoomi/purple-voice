import { cn } from '@/lib/cn';

/**
 * The Purple Voice mark: a four-point spark inside a violet orb — the same
 * motif as the glowing centre in the brand imagery. Colours come from the
 * design tokens, so it follows any palette change.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn('h-8 w-8', className)}>
      <defs>
        <radialGradient id="pv-orb" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="rgb(var(--pv-violet-400))" />
          <stop offset="55%" stopColor="rgb(var(--pv-violet-600))" />
          <stop offset="100%" stopColor="rgb(var(--pv-violet-900))" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#pv-orb)" />
      <path
        d="M20 9.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5-.9-5.6-4.9-9.6-10.5-10.5 5.6-.9 9.6-4.9 10.5-10.5Z"
        fill="white"
      />
      <circle cx="28.5" cy="11.5" r="1.8" fill="white" opacity="0.9" />
    </svg>
  );
}

export function Logo({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'text-[17px] font-bold tracking-tight',
          tone === 'light' ? 'text-white' : 'text-ink',
        )}
      >
        Purple Voice
      </span>
    </span>
  );
}
