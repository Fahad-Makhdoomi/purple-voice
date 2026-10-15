'use client';

import { useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { apiStream } from '@/lib/api';
import { cn } from '@/lib/cn';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'Write a prompt for an agent that books roof inspections',
  'Why would my number show "Needs attention"?',
  'Realtime or Cascaded — which should I use?',
];

/** Streaming chat with the Claude-powered support assistant (Pro). */
export function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Msg[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    try {
      await apiStream('/app/support/assistant', { messages: history.slice(-20) }, (event) => {
        if (typeof event.delta === 'string') {
          setMessages((cur) => {
            const next = [...cur];
            next[next.length - 1] = {
              role: 'assistant',
              content: next[next.length - 1].content + event.delta,
            };
            return next;
          });
          end.current?.scrollIntoView({ block: 'end' });
        }
        if (typeof event.error === 'string') {
          setMessages((cur) => [
            ...cur.slice(0, -1),
            { role: 'assistant', content: String(event.error) },
          ]);
        }
      });
    } catch (err) {
      setMessages((cur) => [
        ...cur.slice(0, -1),
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Something went wrong.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-xl bg-night text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
        <Sparkles size={18} className="text-brand-300" aria-hidden="true" />
        <h2 className="font-semibold text-white">AI support assistant</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-white/65">
              Ask about setup, prompts, numbers or billing. It knows your workspace.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-sm border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <p
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'rounded-br-sm bg-brand-600 text-white'
                  : 'rounded-bl-sm bg-white/[0.08] text-white/90',
              )}
            >
              {m.content || (busy && i === messages.length - 1 ? '…' : '')}
            </p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          Message
        </label>
        <input
          id="assistant-input"
          className="h-11 flex-1 rounded-pill border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-brand-400 focus:outline-none"
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={4000}
        />
        <button
          className="btn btn-brand btn-icon h-11 w-11"
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
