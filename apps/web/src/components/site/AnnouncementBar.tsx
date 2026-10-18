import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ContentSettings } from '@pv/shared';

/**
 * A slim bar above the header on every public page (Admin → Site settings).
 * The site wrapper's [data-announcement] moves the fixed header and the page
 * down by its height (globals.css).
 */
export function AnnouncementBar({ value }: { value: ContentSettings['announcement'] }) {
  return (
    <div className="announcement-bar fixed inset-x-0 top-0 z-[55] flex h-[var(--pv-announce-h)] items-center justify-center gap-2 bg-gradient-brand px-4 text-[13px] font-medium text-white">
      <span className="truncate">{value.text}</span>
      {value.href && (
        <Link
          href={value.href}
          className="inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-4 hover:underline"
        >
          {value.linkLabel || 'Learn more'} <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
