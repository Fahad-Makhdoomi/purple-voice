'use client';

/**
 * Browser API client. Same-origin requests to /api/* with the session
 * cookies; on a 401 it refreshes the session once and retries (the access
 * token lasts 15 minutes, the session 30 days). Staff acting
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
  /** The platform's own workspace (super admins), not a customer's. */
  internal?: boolean;
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

/** Where a 401 means wrong details or no session at all, so refreshing can't help. */
const NO_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

/**
 * ok: the session was renewed. signed_out: it's over, sign in again.
 * unavailable: rate limited, offline or the API restarting; the session may be fine.
 */
type RefreshResult = 'ok' | 'signed_out' | 'unavailable';

const REFRESHED_KEY = 'pv_refreshed_at';

function lastRefreshAt(): number {
  try {
    return Number(window.localStorage.getItem(REFRESHED_KEY)) || 0;
  } catch {
    return 0;
  }
}

async function postRefresh(): Promise<RefreshResult> {
  try {
    const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (r.ok) {
      try {
        window.localStorage.setItem(REFRESHED_KEY, String(Date.now()));
      } catch {
        /* storage unavailable: other tabs just refresh for themselves */
      }
      return 'ok';
    }
    return r.status === 401 || r.status === 403 ? 'signed_out' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * One refresh at a time in this tab and, where the browser has Web Locks,
 * across tabs. Tabs share the session cookie, so a tab that waited while
 * another refreshed uses the new cookie instead of refreshing again.
 */
let refreshing: Promise<RefreshResult> | null = null;
function refreshSession(): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  const askedAt = Date.now();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const run = async (): Promise<RefreshResult> => {
    if (!locks) return postRefresh();
    return locks.request('pv-session-refresh', async () =>
      lastRefreshAt() >= askedAt ? 'ok' : postRefresh(),
    );
  };
  const pending = run().finally(() => {
    setTimeout(() => (refreshing = null), 0);
  });
  refreshing = pending;
  return pending;
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
  if (res.status === 401 && !NO_REFRESH.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed === 'ok') res = await send(path, opts);
    else if (refreshed === 'unavailable') {
      // Not a sign-out: the caller can try again once the server answers.
      throw new ApiError(503, 'unavailable', "Couldn't reach Purple Voice. Try again in a moment.");
    }
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
