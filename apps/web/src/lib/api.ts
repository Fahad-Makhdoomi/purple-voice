'use client';

/**
 * Browser API client. Same-origin requests to /api/* with the session
 * cookies; on a 401 it refreshes the session once and retries. Staff acting
 * inside a customer's workspace send its id in X-Workspace-Id.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const ACTING_KEY = 'pv_acting_workspace';

export interface ActingWorkspace {
  id: string;
  name: string;
}

export function getActingWorkspace(): ActingWorkspace | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ACTING_KEY);
    return raw ? (JSON.parse(raw) as ActingWorkspace) : null;
  } catch {
    return null;
  }
}

export function setActingWorkspace(ws: ActingWorkspace | null) {
  try {
    if (ws) window.sessionStorage.setItem(ACTING_KEY, JSON.stringify(ws));
    else window.sessionStorage.removeItem(ACTING_KEY);
  } catch {
    /* storage unavailable: acting mode simply won't persist */
  }
}

let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Send without the acting-workspace header (admin endpoints). */
  noWorkspace?: boolean;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const acting = opts.noWorkspace ? null : getActingWorkspace();
  if (acting) headers['X-Workspace-Id'] = acting.id;
  return fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    credentials: 'include',
    body:
      opts.body === undefined
        ? undefined
        : isForm
          ? (opts.body as FormData)
          : JSON.stringify(opts.body),
    signal: opts.signal,
  });
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send(path, opts);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; details?: unknown };
  };
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error?.code ?? 'error',
      json.error?.message ?? 'Something went wrong',
      json.error?.details,
    );
  }
  return json as T;
}

/** Streams a Server-Sent Events response (AI assistant), calling onEvent per message. */
export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (data: Record<string, unknown>) => void,
) {
  const res = await send(path, { method: 'POST', body });
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    throw new ApiError(
      res.status,
      json.error?.code ?? 'error',
      json.error?.message ?? 'Request failed',
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data: '));
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}
