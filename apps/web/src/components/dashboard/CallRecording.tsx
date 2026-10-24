'use client';

import { useEffect, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { getActingWorkspace } from '@/lib/api';

/**
 * Plays a call's recording. Recordings are private, so the file is fetched
 * with the session (and, for staff, the acting-workspace header) and played
 * from memory, never from a public link. Loaded on demand: a long call is
 * several megabytes.
 */
export function CallRecording({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function load() {
    setState('loading');
    try {
      const acting = getActingWorkspace();
      const res = await fetch(`/api/app/calls/${callId}/recording`, {
        credentials: 'include',
        headers: acting ? { 'X-Workspace-Id': acting.id } : undefined,
      });
      if (!res.ok) throw new Error(String(res.status));
      setUrl(URL.createObjectURL(await res.blob()));
      setState('idle');
    } catch {
      setState('error');
    }
  }

  if (!url) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={state === 'loading'}
        >
          <Play size={14} aria-hidden="true" />
          {state === 'loading' ? 'Loading…' : 'Play recording'}
        </button>
        {state === 'error' && (
          <p className="text-sm text-danger" role="alert">
            The recording couldn’t be loaded. Refresh the page and try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <audio controls autoPlay src={url} className="w-full">
        Your browser can’t play this recording.
      </audio>
      <a href={url} download={`call-${callId}.wav`} className="btn btn-ghost btn-sm">
        <Download size={14} aria-hidden="true" /> Download
      </a>
    </div>
  );
}
