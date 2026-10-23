import { useEffect, useRef, useState } from 'react';
import type { LyricsData, Track } from './types';

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, { fresh = false, maxAgeMs = 5 * 60_000 } = {}): Promise<T> {
  const hit = cache.get(path);
  if (!fresh && hit && Date.now() - hit.at < maxAgeMs) return hit.data as T;
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    const res = await fetch(`/api${path}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
    cache.set(path, { at: Date.now(), data: body });
    return body as T;
  })().finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

/** State-changing call to the local server (the header proves it's us, not another site). */
export async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pulse': '1' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Forget everything fetched so far (after signing in or out). */
export function clearApiCache() {
  cache.clear();
  cacheEpoch++;
  epochListeners.forEach((fn) => fn());
}

let cacheEpoch = 0;
const epochListeners = new Set<() => void>();

/** Peeks at the cache without fetching — lets pages paint instantly on back nav. */
export const cachedValue = <T,>(path: string): T | undefined => cache.get(path)?.data as T | undefined;

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Minimal stale-while-revalidate hook. Pass `null` to skip fetching. */
export function useApi<T>(path: string | null): QueryState<T> {
  const [state, setState] = useState<{ path: string | null; data: T | undefined; error: Error | null }>(() => ({
    path,
    data: path ? cachedValue<T>(path) : undefined,
    error: null,
  }));
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  // Reset synchronously when the path changes so stale data never flashes.
  if (state.path !== path) {
    setState({ path, data: path ? cachedValue<T>(path) : undefined, error: null });
  }

  useEffect(() => {
    alive.current = true;
    if (!path) return;
    api<T>(path, { fresh: nonce > 0 })
      .then((data) => alive.current && setState((s) => (s.path === path ? { ...s, data, error: null } : s)))
      .catch((error: Error) => alive.current && setState((s) => (s.path === path ? { ...s, error } : s)));
    return () => {
      alive.current = false;
    };
  }, [path, nonce]);

  // Refetch everything on screen after an account change.
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    epochListeners.add(bump);
    return () => {
      epochListeners.delete(bump);
    };
  }, []);

  const data = state.path === path ? state.data : undefined;
  const error = state.path === path ? state.error : null;
  return { data, error, loading: !!path && data === undefined && !error, reload: () => setNonce((n) => n + 1) };
}

export const q = (params: Record<string, string | number | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const lyricsPath = (t: Track) =>
  `/lyrics/${t.id}${q({ title: t.title, artist: t.artists[0]?.name, album: t.album?.name, duration: t.duration })}`;

export type { LyricsData };
