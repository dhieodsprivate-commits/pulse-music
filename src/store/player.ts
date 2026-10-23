import { create } from 'zustand';
import { engine, PlayerState } from '../lib/engine';
import { api, q } from '../lib/api';
import { shuffle as shuffled } from '../lib/format';
import type { QueueSource, Track } from '../lib/types';
import { useLibrary } from './library';
import { toast } from './ui';

export interface QueueItem {
  uid: string;
  track: Track;
}

export type Repeat = 'off' | 'all' | 'one';

interface PlayerStore {
  queue: QueueItem[];
  index: number;
  unshuffled: QueueItem[] | null;
  source: QueueSource | null;
  isPlaying: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  radioLoading: boolean;

  playQueue: (tracks: Track[], start?: number, source?: QueueSource, opts?: { shuffle?: boolean }) => void;
  playTrack: (track: Track, source?: QueueSource) => void;
  startRadio: (track: Track, title?: string) => void;
  playNext: (tracks: Track[]) => void;
  addToQueue: (tracks: Track[]) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  jumpTo: (index: number) => void;
  clearUpcoming: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

let uidCounter = 0;
const wrap = (track: Track): QueueItem => ({ uid: `q${++uidCounter}-${track.id}`, track });

/** Increments whenever the queue is replaced, so stale async radio fetches are dropped. */
let generation = 0;
let counted = false;
let lastTick = 0;
let consecutiveErrors = 0;
const altTried = new Set<string>();
const radioFetched = new Set<string>();

/** Internal callbacks the engine binding needs; assigned when the store is created. */
let handlers: {
  onState: (s: PlayerState) => void;
  onError: (code: number) => void;
  tick: () => void;
  load: (autoplay?: boolean, start?: number) => void;
};

export const usePlayer = create<PlayerStore>()((set, get) => {
  const current = () => get().queue[get().index]?.track ?? null;

  function load(autoplay = true, start = 0) {
    const t = current();
    if (!t) return;
    counted = false;
    lastTick = 0;
    set({ currentTime: start, duration: t.duration ?? 0, buffered: 0, buffering: autoplay, isPlaying: autoplay && get().isPlaying });
    engine.load(t.id, start, autoplay);
    maybeExtend();
  }

  /** Keeps the queue topped up from YouTube Music's radio when autoplay is on. */
  function maybeExtend() {
    const s = get();
    const { autoplay } = useLibrary.getState().settings;
    if (!autoplay || s.repeat !== 'off' || s.index < s.queue.length - 2) return;
    const seed = s.queue[s.queue.length - 1]?.track;
    if (seed) void extendWithRadio(seed);
  }

  async function extendWithRadio(seed: Track): Promise<number> {
    // One radio fetch per seed per queue; repeats would only append duplicates.
    if (radioFetched.has(seed.id)) return 0;
    radioFetched.add(seed.id);
    const gen = generation;
    set({ radioLoading: true });
    try {
      const { tracks } = await api<{ tracks: Track[] }>(`/upnext/${seed.id}`);
      if (gen !== generation) return 0;
      const have = new Set(get().queue.map((x) => x.track.id));
      const fresh = tracks.filter((t) => !have.has(t.id));
      if (fresh.length) {
        // Same items (same uids) in both lists so un-shuffling stays consistent.
        const items = fresh.map(wrap);
        set((s) => ({
          queue: [...s.queue, ...items],
          unshuffled: s.unshuffled ? [...s.unshuffled, ...items] : null,
        }));
      }
      return fresh.length;
    } catch {
      radioFetched.delete(seed.id);
      return 0;
    } finally {
      if (gen === generation) set({ radioLoading: false });
    }
  }

  function replaceQueue(items: QueueItem[], index: number, source: QueueSource | null) {
    generation++;
    radioFetched.clear();
    consecutiveErrors = 0;
    set({ queue: items, index, source, unshuffled: null, isPlaying: true });
    if (get().shuffle) {
      const cur = items[index];
      const rest = items.filter((_, i) => i !== index);
      set({ unshuffled: items, queue: [cur, ...shuffled(rest)], index: 0 });
    }
    load(true);
  }

  handlers = { onState, onError, tick, load };

  return {
    queue: [],
    index: -1,
    unshuffled: null,
    source: null,
    isPlaying: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 80,
    muted: false,
    shuffle: false,
    repeat: 'off',
    radioLoading: false,

    playQueue: (tracks, start = 0, source, opts) => {
      if (!tracks.length) return;
      if (opts?.shuffle !== undefined) set({ shuffle: opts.shuffle });
      let startAt = Math.max(0, Math.min(start, tracks.length - 1));
      if (opts?.shuffle) startAt = Math.floor(Math.random() * tracks.length);
      replaceQueue(tracks.map(wrap), startAt, source ?? null);
    },

    playTrack: (track, source) => {
      const cur = current();
      if (cur?.id === track.id) {
        get().toggle();
        return;
      }
      replaceQueue([wrap(track)], 0, source ?? { kind: 'radio', title: `${track.title} Radio`, id: track.id, thumbnail: track.thumbnail });
      void extendWithRadio(track);
    },

    startRadio: (track, title) => {
      replaceQueue([wrap(track)], 0, { kind: 'radio', title: title ?? `${track.title} Radio`, id: track.id, thumbnail: track.thumbnail });
      void extendWithRadio(track);
    },

    playNext: (tracks) => {
      if (!tracks.length) return;
      const s = get();
      if (s.index < 0) return get().playQueue(tracks, 0, { kind: 'local', title: 'Queue' });
      const items = tracks.map(wrap);
      set({
        queue: [...s.queue.slice(0, s.index + 1), ...items, ...s.queue.slice(s.index + 1)],
        unshuffled: s.unshuffled ? [...s.unshuffled, ...items] : null,
      });
    },

    addToQueue: (tracks) => {
      if (!tracks.length) return;
      const s = get();
      if (s.index < 0) return get().playQueue(tracks, 0, { kind: 'local', title: 'Queue' });
      const items = tracks.map(wrap);
      set({ queue: [...s.queue, ...items], unshuffled: s.unshuffled ? [...s.unshuffled, ...items] : null });
    },

    removeAt: (i) => {
      const s = get();
      if (i < 0 || i >= s.queue.length) return;
      const removed = s.queue[i];
      const queue = s.queue.filter((_, j) => j !== i);
      const unshuffled = s.unshuffled?.filter((x) => x.uid !== removed.uid) ?? null;
      if (i === s.index) {
        if (!queue.length) {
          engine.stop();
          set({ queue, unshuffled, index: -1, isPlaying: false, currentTime: 0, duration: 0 });
          return;
        }
        set({ queue, unshuffled, index: Math.min(i, queue.length - 1) });
        load(s.isPlaying);
      } else {
        set({ queue, unshuffled, index: i < s.index ? s.index - 1 : s.index });
      }
    },

    move: (from, to) => {
      const s = get();
      if (from === to || from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return;
      const queue = [...s.queue];
      const [it] = queue.splice(from, 1);
      queue.splice(to, 0, it);
      const curUid = s.queue[s.index]?.uid;
      set({ queue, index: queue.findIndex((x) => x.uid === curUid) });
    },

    jumpTo: (i) => {
      if (i < 0 || i >= get().queue.length) return;
      set({ index: i, isPlaying: true });
      load(true);
    },

    clearUpcoming: () => {
      const s = get();
      const keep = s.queue.slice(0, s.index + 1);
      const keepIds = new Set(keep.map((x) => x.uid));
      set({ queue: keep, unshuffled: s.unshuffled?.filter((x) => keepIds.has(x.uid)) ?? null });
    },

    toggle: () => (get().isPlaying ? get().pause() : get().play()),

    play: () => {
      if (!current()) return;
      set({ isPlaying: true });
      engine.play();
    },

    pause: () => {
      set({ isPlaying: false });
      engine.pause();
    },

    next: () => advance(false),

    prev: () => {
      const s = get();
      if (engine.time() > 3 || s.index <= 0) {
        engine.seek(0);
        set({ currentTime: 0 });
        if (!s.isPlaying) get().play();
        return;
      }
      set({ index: s.index - 1, isPlaying: true });
      load(true);
    },

    seek: (t) => {
      engine.seek(t);
      set({ currentTime: t });
    },

    setVolume: (v) => {
      const volume = Math.round(Math.max(0, Math.min(100, v)));
      engine.setVolume(volume);
      if (get().muted && volume > 0) engine.setMuted(false);
      set({ volume, muted: volume === 0 ? get().muted : false });
    },

    toggleMute: () => {
      const muted = !get().muted;
      engine.setMuted(muted);
      set({ muted });
    },

    toggleShuffle: () => {
      const s = get();
      const cur = s.queue[s.index];
      if (!s.shuffle) {
        if (!cur) return set({ shuffle: true });
        const before = s.queue.slice(0, s.index);
        const after = s.queue.slice(s.index + 1);
        set({ shuffle: true, unshuffled: s.queue, queue: [...before, cur, ...shuffled(after)] });
      } else {
        const base = s.unshuffled ?? s.queue;
        const known = new Set(base.map((x) => x.uid));
        const extra = s.queue.filter((x) => !known.has(x.uid));
        const queue = [...base, ...extra];
        set({ shuffle: false, unshuffled: null, queue, index: cur ? queue.findIndex((x) => x.uid === cur.uid) : s.index });
      }
    },

    cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  };

  function advance(auto: boolean) {
    const s = get();
    if (!s.queue.length) return;
    if (auto && s.repeat === 'one') {
      engine.seek(0);
      engine.play();
      return;
    }
    if (s.index < s.queue.length - 1) {
      set({ index: s.index + 1, isPlaying: true });
      load(true);
      return;
    }
    if (s.repeat === 'all') {
      set({ index: 0, isPlaying: true });
      load(true);
      return;
    }
    const seed = current();
    if (useLibrary.getState().settings.autoplay && seed) {
      const gen = generation;
      void extendWithRadio(seed).then((added) => {
        if (gen !== generation) return;
        if (added > 0) {
          set({ index: get().index + 1, isPlaying: true });
          load(true);
        } else {
          set({ isPlaying: false });
        }
      });
      return;
    }
    set({ isPlaying: false });
  }

  function onState(state: PlayerState) {
    switch (state) {
      case PlayerState.Playing:
        consecutiveErrors = 0;
        set({ isPlaying: true, buffering: false });
        break;
      case PlayerState.Paused:
        set({ isPlaying: false, buffering: false });
        break;
      case PlayerState.Buffering:
        set({ buffering: true });
        break;
      case PlayerState.Cued:
        set({ buffering: false });
        break;
      case PlayerState.Ended:
        advance(true);
        break;
    }
  }

  async function onError(code: number) {
    const t = current();
    if (!t) return;
    const gen = generation;
    const idx = get().index;
    // 100: removed/private, 101/150/153: owner disabled embedding. Try another upload first.
    if ([100, 101, 150, 153].includes(code) && !altTried.has(t.id)) {
      altTried.add(t.id);
      try {
        const res = await api<{ track: Track | null }>(
          `/alt${q({ title: t.title, artist: t.artists[0]?.name, exclude: t.id })}`,
        );
        if (gen === generation && get().index === idx && res.track) {
          altTried.add(res.track.id);
          const patched: Track = { ...t, id: res.track.id, kind: res.track.kind, duration: res.track.duration ?? t.duration };
          const uid = get().queue[idx]?.uid;
          const swap = (x: QueueItem) => (x.uid === uid ? { ...x, track: patched } : x);
          set((s) => ({ queue: s.queue.map(swap), unshuffled: s.unshuffled?.map(swap) ?? null }));
          load(true);
          return;
        }
      } catch {
        /* fall through to skipping */
      }
    }
    if (gen !== generation || get().index !== idx) return;
    consecutiveErrors++;
    if (consecutiveErrors >= 5) {
      set({ isPlaying: false, buffering: false });
      toast({ title: 'Playback stopped', description: 'Several tracks in a row could not be played.' });
      return;
    }
    toast({ title: `Can't play “${t.title}”`, description: 'Skipping to the next track.' });
    advance(false);
  }

  function tick() {
    const s = get();
    const t = current();
    if (!t || !s.isPlaying) return;
    const now = engine.time();
    const dur = engine.duration() || t.duration || 0;
    if (lastTick && now > lastTick && now - lastTick < 2) useLibrary.getState().addListened(now - lastTick);
    lastTick = now;
    if (!counted && now >= Math.min(10, dur * 0.5 || 10)) {
      counted = true;
      useLibrary.getState().recordPlay(t, s.source ?? undefined);
    }
    set({ currentTime: now, duration: dur, buffered: engine.loadedFraction() });
  }

});

// ---------------------------------------------------------------------------
// Session persistence & engine wiring
// ---------------------------------------------------------------------------

const SESSION_KEY = 'pulse.session';

interface Session {
  queue: Track[];
  index: number;
  source: QueueSource | null;
  time: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
}

function saveSession() {
  const s = usePlayer.getState();
  // Keep a window around the current track so the snapshot stays small.
  const start = Math.max(0, s.index - 50);
  const queue = s.queue.slice(start, s.index + 150).map((x) => x.track);
  const data: Session = {
    queue,
    index: s.index - start,
    source: s.source,
    time: s.currentTime,
    volume: s.volume,
    muted: s.muted,
    shuffle: s.shuffle,
    repeat: s.repeat,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked */
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Session;
    usePlayer.setState({ volume: d.volume ?? 80, muted: !!d.muted, shuffle: !!d.shuffle, repeat: d.repeat ?? 'off' });
    engine.setVolume(d.volume ?? 80);
    engine.setMuted(!!d.muted);
    if (!Array.isArray(d.queue) || !d.queue.length || d.index < 0 || d.index >= d.queue.length) return;
    usePlayer.setState({ queue: d.queue.map(wrap), index: d.index, source: d.source, isPlaying: false });
    handlers.load(false, Math.max(0, (d.time ?? 0) - 1));
  } catch {
    /* corrupted snapshot — start clean */
  }
}

/** Connects the store to the engine. Returns an unbind function. */
export function bindEngine(): () => void {
  const offState = engine.on('state', (s) => handlers.onState(s));
  const offError = engine.on('error', (c) => void handlers.onError(c));
  const timer = window.setInterval(() => handlers.tick(), 250);
  const saver = window.setInterval(saveSession, 5000);
  window.addEventListener('pagehide', saveSession);
  restoreSession();
  const unsub = usePlayer.subscribe((s, prev) => {
    if (s.queue !== prev.queue || s.index !== prev.index || s.repeat !== prev.repeat || s.shuffle !== prev.shuffle) {
      saveSession();
    }
  });
  return () => {
    offState();
    offError();
    clearInterval(timer);
    clearInterval(saver);
    window.removeEventListener('pagehide', saveSession);
    unsub();
  };
}

export const useCurrentTrack = () => usePlayer((s) => s.queue[s.index]?.track ?? null);
