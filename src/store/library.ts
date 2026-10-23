import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Collection, Item, QueueSource, Track } from '../lib/types';

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  track: Track;
  at: number;
  source?: QueueSource;
}

interface PlayStat<T> {
  item: T;
  count: number;
  last: number;
}

export interface Settings {
  autoplay: boolean;
  videoMode: boolean;
  motionBackgrounds: boolean;
  sparks: boolean;
  grain: boolean;
  /** Desktop app only: window glass material. */
  glass: 'acrylic' | 'mica' | 'solid';
  /** Desktop app only: 0 = opaque UI, 1 = maximum see-through. */
  transparency: number;
}

interface LibraryState {
  likes: Track[];
  saved: Collection[];
  playlists: UserPlaylist[];
  history: HistoryEntry[];
  trackStats: Record<string, PlayStat<Track>>;
  artistStats: Record<string, PlayStat<{ name: string; id?: string; thumbnail?: string }>>;
  collectionStats: Record<string, PlayStat<Collection>>;
  pins: Item[];
  searches: string[];
  listenedSeconds: number;
  settings: Settings;

  isLiked: (id: string) => boolean;
  toggleLike: (t: Track) => boolean;
  isSaved: (c: Pick<Collection, 'id' | 'kind'>) => boolean;
  toggleSaved: (c: Collection) => boolean;
  createPlaylist: (name: string, tracks?: Track[]) => UserPlaylist;
  renamePlaylist: (id: string, name: string, description?: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, tracks: Track[]) => number;
  removeFromPlaylist: (id: string, index: number) => void;
  recordPlay: (t: Track, source?: QueueSource) => void;
  addListened: (seconds: number) => void;
  clearHistory: () => void;
  isPinned: (i: Pick<Item, 'id' | 'kind'>) => boolean;
  togglePin: (i: Item) => boolean;
  pushSearch: (q: string) => void;
  removeSearch: (q: string) => void;
  clearSearches: () => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}

const key = (i: Pick<Item, 'id' | 'kind'>) => `${i.kind}:${i.id}`;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Keeps stats maps bounded so localStorage never balloons. */
function trim<T>(map: Record<string, PlayStat<T>>, max: number): Record<string, PlayStat<T>> {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => b[1].count * 4 + b[1].last / 8.64e7 - (a[1].count * 4 + a[1].last / 8.64e7));
  return Object.fromEntries(entries.slice(0, max));
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      likes: [],
      saved: [],
      playlists: [],
      history: [],
      trackStats: {},
      artistStats: {},
      collectionStats: {},
      pins: [],
      searches: [],
      listenedSeconds: 0,
      settings: { autoplay: true, videoMode: false, motionBackgrounds: true, sparks: true, grain: true, glass: 'acrylic', transparency: 0.55 },

      isLiked: (id) => get().likes.some((t) => t.id === id),
      toggleLike: (t) => {
        const liked = get().isLiked(t.id);
        set((s) => ({ likes: liked ? s.likes.filter((x) => x.id !== t.id) : [t, ...s.likes] }));
        return !liked;
      },

      isSaved: (c) => get().saved.some((x) => x.id === c.id && x.kind === c.kind),
      toggleSaved: (c) => {
        const saved = get().isSaved(c);
        set((s) => ({ saved: saved ? s.saved.filter((x) => key(x) !== key(c)) : [c, ...s.saved] }));
        return !saved;
      },

      createPlaylist: (name, tracks = []) => {
        const p: UserPlaylist = {
          id: uid(),
          name: name.trim() || 'Untitled playlist',
          tracks,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ playlists: [p, ...s.playlists] }));
        return p;
      },
      renamePlaylist: (id, name, description) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, description, updatedAt: Date.now() } : p,
          ),
        })),
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      addToPlaylist: (id, tracks) => {
        let added = 0;
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== id) return p;
            const have = new Set(p.tracks.map((t) => t.id));
            const fresh = tracks.filter((t) => !have.has(t.id) && (have.add(t.id), true));
            added = fresh.length;
            return { ...p, tracks: [...p.tracks, ...fresh], updatedAt: Date.now() };
          }),
        }));
        return added;
      },
      removeFromPlaylist: (id, index) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, tracks: p.tracks.filter((_, i) => i !== index), updatedAt: Date.now() } : p,
          ),
        })),

      recordPlay: (t, source) =>
        set((s) => {
          const now = Date.now();
          const history = [{ track: t, at: now, source }, ...s.history].slice(0, 400);
          const ts = s.trackStats[t.id];
          const trackStats = trim(
            { ...s.trackStats, [t.id]: { item: t, count: (ts?.count ?? 0) + 1, last: now } },
            300,
          );
          const artistStats = { ...s.artistStats };
          for (const a of t.artists.slice(0, 2)) {
            const k = a.id ?? `name:${a.name}`;
            const prev = artistStats[k];
            artistStats[k] = {
              item: { name: a.name, id: a.id, thumbnail: prev?.item.thumbnail },
              count: (prev?.count ?? 0) + 1,
              last: now,
            };
          }
          let collectionStats = s.collectionStats;
          if (source?.id && (source.kind === 'album' || source.kind === 'playlist' || source.kind === 'artist')) {
            const c: Collection = { kind: source.kind, id: source.id, title: source.title, thumbnail: source.thumbnail };
            const k = key(c);
            const prev = collectionStats[k];
            collectionStats = trim(
              { ...collectionStats, [k]: { item: { ...prev?.item, ...c }, count: (prev?.count ?? 0) + 1, last: now } },
              120,
            );
          }
          return { history, trackStats, artistStats: trim(artistStats, 200), collectionStats };
        }),
      addListened: (seconds) => set((s) => ({ listenedSeconds: s.listenedSeconds + seconds })),
      clearHistory: () => set({ history: [] }),

      isPinned: (i) => get().pins.some((p) => key(p) === key(i)),
      togglePin: (i) => {
        const pinned = get().isPinned(i);
        set((s) => ({ pins: pinned ? s.pins.filter((p) => key(p) !== key(i)) : [i, ...s.pins].slice(0, 12) }));
        return !pinned;
      },

      pushSearch: (q) => {
        const v = q.trim();
        if (!v) return;
        set((s) => ({ searches: [v, ...s.searches.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 12) }));
      },
      removeSearch: (q) => set((s) => ({ searches: s.searches.filter((x) => x !== q) })),
      clearSearches: () => set({ searches: [] }),

      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),
    }),
    {
      name: 'pulse.library',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        likes: s.likes,
        saved: s.saved,
        playlists: s.playlists,
        history: s.history,
        trackStats: s.trackStats,
        artistStats: s.artistStats,
        collectionStats: s.collectionStats,
        pins: s.pins,
        searches: s.searches,
        listenedSeconds: s.listenedSeconds,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LibraryState>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
      },
    },
  ),
);

/** Remembers artist artwork when we learn it (e.g. visiting an artist page). */
export function rememberArtistThumb(id: string, name: string, thumbnail?: string) {
  if (!thumbnail) return;
  const s = useLibrary.getState();
  const prev = s.artistStats[id];
  if (!prev || prev.item.thumbnail === thumbnail) return;
  useLibrary.setState({ artistStats: { ...s.artistStats, [id]: { ...prev, item: { ...prev.item, name, thumbnail } } } });
}
