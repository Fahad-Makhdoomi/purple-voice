'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Entitlements, Role, UsageSnapshot } from '@pv/shared';
import { api, ApiError, getActingWorkspace, setActingWorkspace, type ActingWorkspace } from './api';

export interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    workspaceId: string | null;
    timezone: string;
    /** Can sign in with "Continue with Google". */
    googleLinked: boolean;
    /** False for accounts created with Google that have never set a password. */
    hasPassword: boolean;
    marketingOptIn?: boolean;
    termsAcceptedAt?: string | null;
    /** The Terms or Privacy Policy changed since the user last accepted them. */
    needsTermsAcceptance?: boolean;
  };
  workspace: { id: string; name: string; timezone: string } | null;
  entitlements: Entitlements | null;
  usage: UsageSnapshot | null;
  staff: boolean;
}

interface SessionValue {
  me: Me | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  acting: ActingWorkspace | null;
  actAs: (ws: ActingWorkspace | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Signed-in user for the dashboard and admin. Redirects to /login when the session is gone. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<ActingWorkspace | null>(null);

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
          () => undefined,
        );
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setActing(getActingWorkspace());
    void reload();
  }, [reload]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setActingWorkspace(null);
    router.replace('/login');
    router.refresh();
  }, [router]);

  const actAs = useCallback((ws: ActingWorkspace | null) => {
    setActingWorkspace(ws);
    setActing(ws);
  }, []);

  return (
    <SessionContext.Provider value={{ me, loading, reload, logout, acting, actAs }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
