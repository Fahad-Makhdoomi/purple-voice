'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

/** Fetches a GET endpoint and keeps it in state. `path = null` skips the request. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const counter = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++counter.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id === counter.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === counter.current)
        setError(err instanceof ApiError ? err : new ApiError(0, 'network', 'Network error'));
    } finally {
      if (id === counter.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
