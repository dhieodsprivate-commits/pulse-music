import { create } from 'zustand';
import { api, clearApiCache, post } from '../lib/api';
import { desktop } from '../lib/desktop';
import type { Track } from '../lib/types';
import { useLibrary } from './library';
import { toast } from './ui';

export interface Account {
  name: string;
  handle?: string;
  photo?: string;
}

interface Status {
  signedIn: boolean;
  /** Signed in, but YouTube stopped accepting the session. */
  expired?: boolean;
  account?: Account | null;
}

interface AccountStore {
  status: Status | null;
  dialog: boolean;
  busy: boolean;
  refresh: () => Promise<Status | null>;
  openDialog: () => void;
  closeDialog: () => void;
  /** Desktop app: sign in on Google's page in an isolated window. */
  signInWithGoogle: () => Promise<string | null>;
  /** Browser fallback: paste a music.youtube.com cookie. */
  connectCookie: (cookie: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

let expiryAnnounced = false;

export const useAccount = create<AccountStore>()((set, get) => {
  const signedInNow = async (account: Account | null | undefined) => {
    expiryAnnounced = false;
    clearApiCache();
    await get().refresh();
    toast({ title: account ? `Signed in as ${account.name}` : 'YouTube Music connected', description: 'Recommendations now come from your account.' });
    void importLikes();
  };

  return {
    status: null,
    dialog: false,
    busy: false,

    refresh: async () => {
      try {
        const status = await api<Status>('/auth/status', { fresh: true });
        set({ status });
        if (status.expired && !expiryAnnounced) {
          expiryAnnounced = true;
          toast({
            title: 'YouTube Music session expired',
            description: 'Showing general recommendations until you sign in again.',
            actionLabel: 'Sign in',
            onAction: () => get().openDialog(),
            duration: 8000,
          });
        }
        return status;
      } catch {
        return null;
      }
    },

    openDialog: () => {
      set({ dialog: true });
      void get().refresh();
    },
    closeDialog: () => set({ dialog: false }),

    signInWithGoogle: async () => {
      if (!desktop) return 'Google sign-in is available in the desktop app.';
      set({ busy: true });
      try {
        const res = await desktop.googleLogin();
        if (!res.ok) return /closed/i.test(res.error ?? '') ? null : (res.error ?? 'Sign-in did not complete.');
        await signedInNow(res.account);
        set({ dialog: false });
        return null;
      } catch (err) {
        return (err as Error).message;
      } finally {
        set({ busy: false });
      }
    },

    connectCookie: async (cookie) => {
      set({ busy: true });
      try {
        const res = await post<{ ok: boolean; error?: string; account?: Account | null }>('/auth/cookie', { cookie });
        if (!res.ok) return res.error ?? 'That cookie did not work.';
        await signedInNow(res.account);
        set({ dialog: false });
        return null;
      } catch (err) {
        return (err as Error).message;
      } finally {
        set({ busy: false });
      }
    },

    logout: async () => {
      await post('/auth/logout').catch(() => {});
      await desktop?.googleLogout().catch(() => {});
      clearApiCache();
      await get().refresh();
      toast({ title: 'Signed out', description: 'Back to general recommendations.' });
    },
  };
});

const isActive = () => {
  const s = useAccount.getState().status;
  return !!s?.signedIn && !s.expired;
};

// ---------------------------------------------------------------------------
// Two-way sync with the account
// ---------------------------------------------------------------------------

/** While importing we change likes locally without echoing them back to YouTube. */
let importing = false;

/** Pulls the account's liked songs into the local library (union, no duplicates). */
export async function importLikes() {
  try {
    const { tracks } = await api<{ tracks: Track[] }>('/me/liked', { fresh: true });
    const local = useLibrary.getState().likes;
    const have = new Set(local.map((t) => t.id));
    const missing = tracks.filter((t) => !have.has(t.id));
    if (!missing.length) return;
    importing = true;
    useLibrary.setState({ likes: [...local, ...missing] });
  } catch {
    /* not signed in or offline — local likes still work */
  } finally {
    importing = false;
  }
}

/** Mirrors likes and listens to the account so YouTube Music learns from Pulse. */
export function startAccountSync(): () => void {
  const reported = new Set<string>();
  const unsubLikes = useLibrary.subscribe((s, prev) => {
    if (importing || s.likes === prev.likes || !isActive()) return;
    const before = new Set(prev.likes.map((t) => t.id));
    const after = new Set(s.likes.map((t) => t.id));
    for (const id of after) if (!before.has(id)) void post('/me/rate', { id, like: true }).catch(() => {});
    for (const id of before) if (!after.has(id)) void post('/me/rate', { id, like: false }).catch(() => {});
  });
  const unsubHistory = useLibrary.subscribe((s, prev) => {
    if (s.history === prev.history || !isActive()) return;
    const latest = s.history[0];
    if (!latest || latest === prev.history[0]) return;
    const key = `${latest.track.id}:${latest.at}`;
    if (reported.has(key)) return;
    reported.add(key);
    void post('/me/history', { id: latest.track.id }).catch(() => {});
  });
  // Re-check the session periodically so an expiry surfaces without a restart.
  const timer = setInterval(() => void useAccount.getState().refresh(), 10 * 60_000);
  return () => {
    unsubLikes();
    unsubHistory();
    clearInterval(timer);
  };
}
