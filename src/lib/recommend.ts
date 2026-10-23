/**
 * Local personalization. Everything is derived from on-device listening
 * history; YouTube Music supplies the related/radio data on top.
 */
import { useMemo } from 'react';
import { useLibrary } from '../store/library';
import type { Collection, Item, Track } from './types';
import { isTrack } from './types';

const DAY = 86_400_000;

/** Frequency with a gentle recency boost — a song played often last week beats one played once today. */
const score = (count: number, last: number) => count * 2 + Math.max(0, 8 - (Date.now() - last) / DAY);

export interface DialItem {
  item: Item;
  pinned?: boolean;
  /** Artwork to use when the item itself has none (artists from track metadata). */
  art?: string;
  suggested?: boolean;
}

export function useSpeedDial(fallback: Item[], max = 12): DialItem[] {
  const pins = useLibrary((s) => s.pins);
  const trackStats = useLibrary((s) => s.trackStats);
  const artistStats = useLibrary((s) => s.artistStats);
  const collectionStats = useLibrary((s) => s.collectionStats);

  return useMemo(() => {
    const out: DialItem[] = [];
    const seen = new Set<string>();
    const add = (d: DialItem) => {
      const k = `${d.item.kind}:${d.item.id}`;
      if (seen.has(k) || out.length >= max) return;
      seen.add(k);
      out.push(d);
    };
    pins.forEach((p) => add({ item: p, pinned: true }));

    const tracks = Object.values(trackStats).sort((a, b) => score(b.count, b.last) - score(a.count, a.last));
    const artArt = (artistId?: string, name?: string) =>
      tracks.find((t) => t.item.artists.some((a) => (artistId ? a.id === artistId : a.name === name)))?.item.thumbnail;

    const collections = Object.values(collectionStats)
      .sort((a, b) => score(b.count, b.last) - score(a.count, a.last))
      .map((c) => ({ item: c.item as Item, s: score(c.count, c.last) }));
    const artists = Object.values(artistStats)
      .filter((a) => a.item.id && a.count >= 2)
      .sort((a, b) => score(b.count, b.last) - score(a.count, a.last))
      .map((a) => ({
        item: { kind: 'artist', id: a.item.id!, title: a.item.name, thumbnail: a.item.thumbnail } as Collection as Item,
        art: a.item.thumbnail ?? artArt(a.item.id, a.item.name),
        s: score(a.count, a.last) * 0.8,
      }));
    const songs = tracks.slice(0, 30).map((t) => ({ item: t.item as Item, s: score(t.count, t.last) }));

    // Interleave the three pools by score so the grid feels varied.
    const pools = [collections, artists, songs].map((p) => [...p]);
    while (out.length < max && pools.some((p) => p.length)) {
      let best = -1;
      for (let i = 0; i < pools.length; i++) {
        if (pools[i].length && (best < 0 || pools[i][0].s > pools[best][0].s)) best = i;
      }
      const next = pools[best].shift()!;
      add({ item: next.item, art: 'art' in next ? (next.art as string | undefined) : undefined });
      // Rotate preference so one pool can't fill every slot.
      pools.push(pools.splice(best, 1)[0]);
    }
    for (const f of fallback) add({ item: f, suggested: true });
    return out;
  }, [pins, trackStats, artistStats, collectionStats, fallback, max]);
}

/** Seeds for /api/recommend: most recent listens plus the all-time favorite. */
export function useSeeds(): string[] {
  const history = useLibrary((s) => s.history);
  const trackStats = useLibrary((s) => s.trackStats);
  const likes = useLibrary((s) => s.likes);
  return useMemo(() => {
    const seeds: string[] = [];
    for (const h of history) {
      if (!seeds.includes(h.track.id)) seeds.push(h.track.id);
      if (seeds.length >= 2) break;
    }
    const top = Object.values(trackStats).sort((a, b) => b.count - a.count)[0];
    if (top && !seeds.includes(top.item.id)) seeds.push(top.item.id);
    // A third distinct recent track if we still have room.
    for (const h of history) {
      if (seeds.length >= 3) break;
      if (!seeds.includes(h.track.id)) seeds.push(h.track.id);
    }
    // New here but signed in? Liked songs (imported from the account) are great seeds.
    for (const t of likes) {
      if (seeds.length >= 3) break;
      if (!seeds.includes(t.id)) seeds.push(t.id);
    }
    return seeds;
    // Recompute only when the most recent listens/likes change, not on every count bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history[0]?.track.id, history[1]?.track.id, history[2]?.track.id, likes[0]?.id, likes.length > 0]);
}

export function useListenAgain(max = 20): Item[] {
  const history = useLibrary((s) => s.history);
  const collectionStats = useLibrary((s) => s.collectionStats);
  return useMemo(() => {
    const out: { item: Item; at: number }[] = [];
    const seen = new Set<string>();
    for (const c of Object.values(collectionStats)) {
      const k = `${c.item.kind}:${c.item.id}`;
      if (!seen.has(k)) (seen.add(k), out.push({ item: c.item, at: c.last }));
    }
    for (const h of history) {
      const k = `${h.track.kind}:${h.track.id}`;
      if (!seen.has(k)) (seen.add(k), out.push({ item: h.track, at: h.at }));
    }
    return out.sort((a, b) => b.at - a.at).slice(0, max).map((x) => x.item);
  }, [history, collectionStats, max]);
}

export interface Mix {
  id: string;
  title: string;
  subtitle: string;
  seed: Track;
  art: string[];
  hue: number;
}

/** "Mixed for you": a Supermix plus one radio mix per favorite artist. */
export function useMixes(): Mix[] {
  const trackStats = useLibrary((s) => s.trackStats);
  const artistStats = useLibrary((s) => s.artistStats);
  return useMemo(() => {
    const tracks = Object.values(trackStats).sort((a, b) => score(b.count, b.last) - score(a.count, a.last));
    if (!tracks.length) return [];
    const mixes: Mix[] = [];
    const arts = (list: typeof tracks) => [...new Set(list.map((t) => t.item.thumbnail).filter(Boolean))].slice(0, 3) as string[];
    mixes.push({
      id: 'supermix',
      title: 'My Supermix',
      subtitle: tracks.slice(0, 3).map((t) => t.item.artists[0]?.name).filter(Boolean).join(', '),
      seed: tracks[0].item,
      art: arts(tracks.slice(0, 6)),
      hue: 330,
    });
    const topArtists = Object.values(artistStats)
      .filter((a) => a.item.id)
      .sort((a, b) => score(b.count, b.last) - score(a.count, a.last))
      .slice(0, 5);
    topArtists.forEach((a, i) => {
      const theirs = tracks.filter((t) => t.item.artists.some((x) => x.id === a.item.id));
      if (!theirs.length) return;
      mixes.push({
        id: `artist-${a.item.id}`,
        title: `${a.item.name} Mix`,
        subtitle: `${a.item.name} and more like them`,
        seed: theirs[0].item,
        art: arts(theirs).length ? arts(theirs) : arts(tracks.slice(i, i + 3)),
        hue: (200 + i * 47) % 360,
      });
    });
    if (tracks.length > 8) {
      const deep = tracks.slice(Math.floor(tracks.length / 2));
      mixes.push({
        id: 'discover',
        title: 'Discover Mix',
        subtitle: 'Deeper cuts from your rotation',
        seed: deep[0].item,
        art: arts(deep),
        hue: 160,
      });
    }
    return mixes;
  }, [trackStats, artistStats]);
}

/** Items worth showing from a generic list, deduped against what's already shown. */
export const exclude = (items: Item[], seen: Set<string>) =>
  items.filter((i) => {
    const k = `${i.kind}:${i.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

export const topTracks = (stats: Record<string, { item: Track; count: number; last: number }>, n: number): Track[] =>
  Object.values(stats)
    .sort((a, b) => score(b.count, b.last) - score(a.count, a.last))
    .slice(0, n)
    .map((s) => s.item)
    .filter(isTrack);
