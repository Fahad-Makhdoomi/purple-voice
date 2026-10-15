'use client';

import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

export interface ThreadMessage {
  id: string;
  body: string;
  fromStaff: boolean;
  createdAt: string;
  author: { name: string } | null;
}

/** A support conversation; customer on the left, staff on the right (or the reverse for staff). */
export function TicketThread({
  messages,
  viewer,
}: {
  messages: ThreadMessage[];
  viewer: 'customer' | 'staff';
}) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = viewer === 'staff' ? m.fromStaff : !m.fromStaff;
        return (
          <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-3',
                mine ? 'bg-ink text-white' : 'bg-brand-50 text-ink',
              )}
            >
              <p className={cn('text-xs font-semibold', mine ? 'text-white/60' : 'text-muted')}>
                {m.author?.name ?? 'Unknown'}
                {m.fromStaff ? ' · Purple Voice' : ''} · {formatDateTime(m.createdAt)}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
