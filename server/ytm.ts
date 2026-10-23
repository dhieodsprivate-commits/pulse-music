/**
 * YouTube Music data layer.
 *
 * Wraps youtubei.js (InnerTube) and normalizes its deeply nested parser nodes
 * into small, stable JSON shapes the client can rely on. Every public function
 * returns plain objects only — no youtubei.js classes leak out.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Innertube } from 'youtubei.js';
import { createSession, loadAuth, readAccount } from './auth.ts';

// ---------------------------------------------------------------------------
// Public shapes (mirrored in src/lib/types.ts)
// ---------------------------------------------------------------------------

export interface ArtistRef {
  name: string;
  id?: string;
}

export interface Track {
  kind: 'song' | 'video';
  id: string;
  title: string;
  artists: ArtistRef[];
  album?: { name: string; id?: string };
  duration?: number;
  thumbnail?: string;
  views?: string;
}

export interface Collection {
  kind: 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  /** Only for albums / singles. */
  year?: string;
}

export type Item = Track | Collection;

export interface Section {
  title: string;
  subtitle?: string;
  items: Item[];
}

// ---------------------------------------------------------------------------
// Session handling
// ---------------------------------------------------------------------------

let session: Promise<Innertube> | null = null;
let anonSession: Promise<Innertube> | null = null;
/** Bumped on sign-in/out so cached personalized data never leaks across accounts. */
let authGeneration = 0;
/** Set when YouTube stops accepting the stored session; we then serve anonymous data. */
let authBroken = false;
/** Lets a single request run anonymously without affecting concurrent ones. */
const anonScope = new AsyncLocalStorage<true>();

function anon(): Promise<Innertube> {
  if (!anonSession) {
    anonSession = createSession(null).catch((err) => {
      anonSession = null;
      throw err;
    });
  }
  return anonSession;
}

function yt(): Promise<Innertube> {
  if (anonScope.getStore() || authBroken || !loadAuth()) return anon();
  if (!session) {
    session = createSession().catch((err) => {
      session = null;
      throw err;
    });
  }
  return session;
}

/** Drops the current InnerTube sessions so the next call starts fresh. */
export function resetSession() {
  session = null;
  anonSession = null;
}

/** Call after signing in or out: new session, empty cache. */
export function onAuthChanged() {
  authGeneration++;
  authBroken = false;
  session = null;
  cache.clear();
}

export const isSignedIn = () => loadAuth() !== null;
export const isAuthBroken = () => authBroken && isSignedIn();
export const runAnonymously = <T,>(fn: () => Promise<T>) => anonScope.run(true, fn);

/** The stored session stopped working: serve anonymous data until the user signs in again. */
export function markAuthBroken() {
  if (authBroken) return;
  authBroken = true;
  authGeneration++;
  cache.clear();
  console.warn('[auth] YouTube rejected the saved session; using anonymous mode until you sign in again.');
}

// ---------------------------------------------------------------------------
// Tiny TTL cache so navigating back and forth is instant.
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(rawKey: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const key = `${authGeneration}|${rawKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
    for (const [k] of oldest) cache.delete(k);
  }
  return value;
}

const MIN = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyNode = any; // youtubei.js nodes are heavily polymorphic; we narrow by hand.

const text = (t: AnyNode): string => {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (typeof t.toString === 'function') {
    const s = t.toString();
    if (s && s !== '[object Object]') return s;
  }
  return t.text ?? '';
};

/**
 * Google's image CDN resizes on the fly and rate-limits (HTTP 429) requests
 * for sizes it hasn't cached. We only ever ask for the variants YouTube Music
 * itself uses, so they're served from cache.
 */
const STANDARD_SIZES = [60, 120, 226, 544];
const standardSize = (px: number) => STANDARD_SIZES.find((s) => s >= px) ?? 544;

/** Rewrites a small square Google image to a standard, cached size. */
export function upscale(url: string | undefined, size = 544): string | undefined {
  if (!url) return undefined;
  let u = url.startsWith('//') ? `https:${url}` : url;
  if (/(googleusercontent\.com|ggpht\.com)/.test(u) && /=w(\d+)-h\1-/.test(u)) {
    const s = standardSize(size);
    u = u.replace(/=w\d+-h\d+(-p)?-l90-rj$/, `=w${s}-h${s}$1-l90-rj`);
  }
  return u;
}

function pickThumb(thumbs: AnyNode, size = 544): string | undefined {
  const list: AnyNode[] = Array.isArray(thumbs)
    ? thumbs
    : Array.isArray(thumbs?.contents)
      ? thumbs.contents
      : [];
  if (!list.length) return undefined;
  const best = [...list].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  const url: string | undefined = best?.url?.startsWith('//') ? `https:${best.url}` : best?.url;
  // Big enough already (or a non-square banner/video frame): use it untouched.
  if (!url || (best.width ?? 0) >= Math.min(size, 544)) return url;
  return upscale(url, size);
}

const cleanArtists = (list: AnyNode): ArtistRef[] =>
  (Array.isArray(list) ? list : [])
    .filter((a) => a?.name && a.name.trim() && !/^\s*[•,&]\s*$/.test(a.name))
    .map((a) => ({ name: String(a.name).trim(), id: a.channel_id || undefined }));

/** Splits a "Song • Artist • 3.4M plays" style subtitle into its runs. */
const subtitleParts = (t: AnyNode): string[] =>
  text(t)
    .split(' • ')
    .map((s) => s.trim())
    .filter(Boolean);

/** Converts a "VL…" browse id into the playlist id the player understands. */
const playlistId = (id: string) => (id.startsWith('VL') ? id.slice(2) : id);

const parseDuration = (s: string | undefined): number | undefined => {
  if (!s || !/^\d+(:\d+){1,2}$/.test(s)) return undefined;
  return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
};

// ---------------------------------------------------------------------------
// Node -> Item normalizers
// ---------------------------------------------------------------------------

function fromListItem(n: AnyNode, fallbackThumb?: string, fallbackAlbum?: Track['album']): Item | null {
  const type: string | undefined = n?.item_type;
  const thumb = pickThumb(n?.thumbnail) ?? fallbackThumb;

  if (type === 'song' || type === 'video' || type === 'non_music_track') {
    if (!n.id || !n.title) return null;
    const artists = cleanArtists(n.artists?.length ? n.artists : n.authors);
    if (!artists.length && n.author?.name) artists.push({ name: n.author.name, id: n.author.channel_id });
    return {
      kind: type === 'song' || (type === 'video' && fallbackAlbum) ? 'song' : 'video',
      id: n.id,
      title: n.title,
      artists,
      album: n.album?.name ? { name: n.album.name, id: n.album.id } : fallbackAlbum,
      duration: n.duration?.seconds || undefined,
      thumbnail: thumb,
      views: n.views,
    };
  }
  if (type === 'album') {
    if (!n.id) return null;
    const parts = subtitleParts(n.subtitle);
    return {
      kind: 'album',
      id: n.id,
      title: n.title ?? text(n.flex_columns?.[0]?.title),
      subtitle: [n.author?.name ?? cleanArtists(n.artists).map((a) => a.name).join(', '), n.year]
        .filter(Boolean)
        .join(' • ') || parts.join(' • '),
      thumbnail: thumb,
      year: n.year,
    };
  }
  if (type === 'playlist') {
    if (!n.id) return null;
    return {
      kind: 'playlist',
      id: playlistId(n.id),
      title: n.title ?? '',
      subtitle: [n.author?.name, n.item_count].filter(Boolean).join(' • ') || undefined,
      thumbnail: thumb,
    };
  }
  if (type === 'artist' || type === 'library_artist') {
    if (!n.id) return null;
    // "Profile" results are random user channels, not artists.
    if (/^Profile\b/.test(text(n.subtitle))) return null;
    return {
      kind: 'artist',
      id: n.id,
      title: n.name ?? n.title ?? '',
      subtitle: n.subscribers || subtitleParts(n.subtitle).slice(1).join(' • ') || undefined,
      thumbnail: pickThumb(n.thumbnail, 400),
    };
  }
  return null;
}

function fromTwoRowItem(n: AnyNode): Item | null {
  const type: string = n?.item_type ?? '';
  const title = text(n.title);
  const thumb = pickThumb(n.thumbnail);
  const parts = subtitleParts(n.subtitle);
  if (!n?.id || !title) return null;

  if (type === 'song' || type === 'video') {
    const artists = cleanArtists(n.artists);
    if (!artists.length && n.author?.name) artists.push({ name: n.author.name, id: n.author.channel_id });
    if (!artists.length) {
      const runs = parts.filter((p) => !/^(Song|Video|Single|EP)$/i.test(p) && !/views?|plays?$/i.test(p));
      if (runs[0]) artists.push({ name: runs[0] });
    }
    return {
      kind: type === 'song' ? 'song' : 'video',
      id: n.id,
      title,
      artists,
      thumbnail: thumb,
      views: n.views,
    };
  }
  if (type === 'album') {
    return { kind: 'album', id: n.id, title, subtitle: parts.join(' • ') || undefined, thumbnail: thumb, year: n.year };
  }
  if (type === 'playlist' || type === 'station') {
    return { kind: 'playlist', id: playlistId(n.id), title, subtitle: parts.join(' • ') || undefined, thumbnail: thumb };
  }
  if (type === 'artist') {
    return { kind: 'artist', id: n.id, title, subtitle: n.subscribers ?? (parts.join(' • ') || undefined), thumbnail: pickThumb(n.thumbnail, 400) };
  }
  return null;
}

function fromAny(n: AnyNode, fallbackThumb?: string, fallbackAlbum?: Track['album']): Item | null {
  switch (n?.type) {
    case 'MusicResponsiveListItem':
      return fromListItem(n, fallbackThumb, fallbackAlbum);
    case 'MusicTwoRowItem':
      return fromTwoRowItem(n);
    case 'MusicMultiRowListItem':
      return null;
    default:
      return null;
  }
}

function fromPanelVideo(n: AnyNode): Track | null {
  const v = n?.type === 'PlaylistPanelVideoWrapper' ? n.primary : n;
  if (v?.type !== 'PlaylistPanelVideo' || !v.video_id) return null;
  const artists = cleanArtists(v.artists);
  if (!artists.length && v.author) artists.push({ name: v.author });
  return {
    kind: v.album?.name ? 'song' : 'video',
    id: v.video_id,
    title: text(v.title),
    artists,
    album: v.album?.name ? { name: v.album.name, id: v.album.id } : undefined,
    duration: v.duration?.seconds || undefined,
    thumbnail: pickThumb(v.thumbnail),
  };
}

const compact = <T,>(xs: (T | null | undefined)[]): T[] => xs.filter((x): x is T => x != null);

const dedupe = <T extends { id: string; kind: string }>(xs: T[]): T[] => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = `${x.kind}:${x.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

function shelfToSection(shelf: AnyNode): Section | null {
  if (!shelf) return null;
  const title = text(shelf.header?.title ?? shelf.title);
  const items = dedupe(compact<Item>((shelf.contents ?? []).map((n: AnyNode) => fromAny(n))));
  if (!title || !items.length) return null;
  const strap = text(shelf.header?.strapline);
  return { title, subtitle: strap || undefined, items };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function home(mood?: string) {
  return cached(`home:${mood ?? ''}`, 15 * MIN, async () => {
    const client = await yt();
    let feed: AnyNode = await client.music.getHomeFeed();
    const moods: string[] = (feed.header?.chips ?? [])
      .map((c: AnyNode) => text(c.text))
      .filter((t: string) => t && t !== 'Podcasts');

    if (mood) {
      const chip = (feed.header?.chips ?? []).find((c: AnyNode) => text(c.text) === mood);
      if (chip) feed = await feed.applyFilter(chip);
    }

    const sections: Section[] = compact<Section>((feed.sections ?? []).map(shelfToSection));
    // Signed-out home feeds are short; pull a few continuations for a rich page.
    for (let i = 0; i < 4 && feed.has_continuation; i++) {
      try {
        feed = await feed.getContinuation();
        sections.push(...compact<Section>((feed.sections ?? []).map(shelfToSection)));
      } catch {
        break;
      }
    }
    const seen = new Set<string>();
    return {
      moods,
      sections: sections.filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true))),
    };
  });
}

export async function explore() {
  return cached('explore', 30 * MIN, async () => {
    const client = await yt();
    const ex: AnyNode = await client.music.getExplore();
    return { sections: compact((ex.sections ?? []).map(shelfToSection)) };
  });
}

export type SearchFilter = 'all' | 'song' | 'video' | 'album' | 'artist' | 'playlist';

export async function search(q: string, filter: SearchFilter = 'all') {
  const query = q.trim().slice(0, 200);
  if (!query) return { top: null, items: [] as Item[] };
  return cached(`search:${filter}:${query.toLowerCase()}`, 10 * MIN, async () => {
    const client = await yt();
    const res: AnyNode = await client.music.search(
      query,
      filter === 'all' ? undefined : { type: filter },
    );
    let top: Item | null = null;
    const items: Item[] = [];
    for (const block of res.contents ?? []) {
      if (block.type === 'MusicCardShelf') {
        // The highlighted "top result" card plus a few related tracks.
        top = cardShelfTop(block) ?? top;
        // Songs listed under the top-result card omit their artist; it's implied by the card.
        const implied: ArtistRef[] =
          top?.kind === 'artist' ? [{ name: top.title, id: top.id }] : top && 'artists' in top ? top.artists : [];
        for (const n of block.contents ?? []) {
          const it = fromAny(n);
          if (!it) continue;
          if ((it.kind === 'song' || it.kind === 'video') && !it.artists.length) it.artists = implied;
          items.push(it);
        }
        continue;
      }
      for (const n of block.contents ?? []) {
        const it = fromAny(n);
        if (it) items.push(it);
      }
    }
    const unique = dedupe(items);
    return { top, items: top ? unique.filter((i) => !(i.kind === top!.kind && i.id === top!.id)) : unique };
  });
}

function cardShelfTop(card: AnyNode): Item | null {
  const ep = card.title?.endpoint ?? card.endpoint ?? card.on_tap;
  const payload = ep?.payload ?? {};
  const title = text(card.title);
  const parts = subtitleParts(card.subtitle);
  const thumb = pickThumb(card.thumbnail);
  const pageType: string | undefined =
    payload.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

  if (payload.videoId) {
    const artistRuns = (card.subtitle?.runs ?? [])
      .filter((r: AnyNode) => r.endpoint?.payload?.browseId?.startsWith?.('UC'))
      .map((r: AnyNode) => ({ name: r.text, id: r.endpoint.payload.browseId }));
    return {
      kind: /^Video$/i.test(parts[0] ?? '') ? 'video' : 'song',
      id: payload.videoId,
      title,
      artists: artistRuns.length ? artistRuns : parts[1] ? [{ name: parts[1] }] : [],
      thumbnail: thumb,
      duration: parseDuration(parts[parts.length - 1]),
    };
  }
  if (payload.browseId) {
    const id: string = payload.browseId;
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || id.startsWith('UC')) {
      return { kind: 'artist', id, title, subtitle: parts.slice(1).join(' • ') || undefined, thumbnail: pickThumb(card.thumbnail, 400) };
    }
    if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || id.startsWith('MPRE')) {
      return { kind: 'album', id, title, subtitle: parts.join(' • ') || undefined, thumbnail: thumb };
    }
    if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' || id.startsWith('VL')) {
      return { kind: 'playlist', id: playlistId(id), title, subtitle: parts.join(' • ') || undefined, thumbnail: thumb };
    }
  }
  return null;
}

export async function suggest(q: string): Promise<string[]> {
  const query = q.trim().slice(0, 120);
  if (!query) return [];
  return cached(`suggest:${query.toLowerCase()}`, 30 * MIN, async () => {
    const client = await yt();
    const sections: AnyNode[] = await client.music.getSearchSuggestions(query);
    const out: string[] = [];
    for (const s of sections) {
      for (const c of s.contents ?? []) {
        if (c.type === 'SearchSuggestion') {
          const t = text(c.suggestion);
          if (t) out.push(t);
        }
      }
    }
    return [...new Set(out)].slice(0, 8);
  });
}

export async function album(id: string) {
  return cached(`album:${id}`, 60 * MIN, async () => {
    const client = await yt();
    const a: AnyNode = await client.music.getAlbum(id);
    const h: AnyNode = a.header ?? {};
    const thumb = pickThumb(h.thumbnail, 800);
    const title = text(h.title);
    const artistRuns: ArtistRef[] = (h.strapline_text_one?.runs ?? [])
      .filter((r: AnyNode) => r.text && !/^\s*[•,&]\s*$/.test(r.text))
      .map((r: AnyNode) => ({ name: r.text.trim(), id: r.endpoint?.payload?.browseId }));
    const albumRef = { name: title, id };
    const tracks = compact((a.contents ?? []).map((n: AnyNode) => fromListItem(n, upscale(thumb, 544), albumRef))) as Track[];
    for (const t of tracks) if (!t.artists.length) t.artists = artistRuns;
    return {
      id,
      title,
      type: subtitleParts(h.subtitle)[0] ?? 'Album',
      artists: artistRuns,
      year: subtitleParts(h.subtitle).find((p) => /^\d{4}$/.test(p)),
      meta: text(h.second_subtitle),
      description: text(h.description?.description) || undefined,
      thumbnail: thumb,
      playlistId: a.url ? new URL(a.url).searchParams.get('list') ?? undefined : undefined,
      tracks,
      sections: compact((a.sections ?? []).map(shelfToSection)),
    };
  });
}

export async function playlist(rawId: string) {
  const id = playlistId(rawId);
  return cached(`playlist:${id}`, 20 * MIN, async () => {
    const client = await yt();
    let p: AnyNode = await client.music.getPlaylist(id);
    const h: AnyNode = p.header ?? {};
    const thumb = pickThumb(h.thumbnail ?? p.background, 800);
    const tracks: Track[] = compact((p.contents ?? []).map((n: AnyNode) => fromListItem(n))) as Track[];
    // Pull a few continuation pages so long playlists are actually useful.
    for (let i = 0; i < 4 && p.has_continuation && tracks.length < 400; i++) {
      try {
        p = await p.getContinuation();
        tracks.push(...(compact((p.contents ?? p.items ?? []).map((n: AnyNode) => fromListItem(n))) as Track[]));
      } catch {
        break;
      }
    }
    let related: Section[] = [];
    try {
      const rel = await p.getRelated();
      const s = shelfToSection(rel);
      if (s) related = [s];
    } catch {
      /* related shelf is optional */
    }
    return {
      id,
      title: text(h.title),
      subtitle: text(h.subtitle) || undefined,
      author: /^(N\/A)?$/.test(text(h.strapline_text_one).trim()) ? undefined : text(h.strapline_text_one),
      meta: text(h.second_subtitle) || undefined,
      description: text(h.description?.description ?? h.description) || undefined,
      thumbnail: thumb,
      tracks: dedupe(tracks),
      sections: related,
    };
  });
}

export async function artist(id: string) {
  return cached(`artist:${id}`, 30 * MIN, async () => {
    const client = await yt();
    const a: AnyNode = await client.music.getArtist(id);
    const h: AnyNode = a.header ?? {};
    const name = text(h.title);
    const banner = pickThumb(h.thumbnail, 1440);
    const avatar = pickThumb(h.foreground_thumbnail, 400);
    let songs: Track[] = [];
    const sections: Section[] = [];
    for (const s of a.sections ?? []) {
      if (s.type === 'MusicShelf') {
        songs = compact<Item>((s.contents ?? []).map((n: AnyNode) => fromListItem(n))).filter(
          (t: Item): t is Track => t.kind === 'song' || t.kind === 'video',
        );
        continue;
      }
      const sec = shelfToSection(s);
      if (sec) sections.push(sec);
    }
    // The page only carries the top 5; the "Show all" playlist has the full catalogue.
    try {
      const all: AnyNode = await a.getAllSongs();
      const more = compact<Item>((all?.contents ?? []).map((n: AnyNode) => fromListItem(n))).filter(
        (t): t is Track => t.kind === 'song' || t.kind === 'video',
      );
      if (more.length > songs.length) songs = dedupe([...songs, ...more]).slice(0, 150);
    } catch {
      /* keep the top songs we already have */
    }
    for (const t of songs) if (!t.artists.length) t.artists = [{ name, id }];
    return {
      id,
      name,
      description: text(h.description) || undefined,
      subscribers: text(h.subscription_button?.subscriber_count) || undefined,
      banner: banner ? upscale(banner, 1440) : undefined,
      avatar: avatar ?? banner,
      songs,
      sections,
    };
  });
}

export async function upNext(videoId: string, playlist?: string) {
  return cached(`upnext:${videoId}:${playlist ?? ''}`, 20 * MIN, async () => {
    const client = await yt();
    let panel: AnyNode;
    if (playlist) {
      panel = await client.music.getUpNext(videoId, false).catch(() => null);
    }
    panel = panel ?? (await client.music.getUpNext(videoId, true));
    const tracks = dedupe(compact<Track>((panel?.contents ?? []).map(fromPanelVideo)));
    return { tracks };
  });
}

export async function lyrics(videoId: string) {
  return cached(`lyrics:${videoId}`, 60 * MIN, async () => {
    const client = await yt();
    try {
      const shelf: AnyNode = await client.music.getLyrics(videoId);
      const body = text(shelf?.description);
      if (!body) return { lyrics: null, source: null };
      return { lyrics: body, source: text(shelf.footer) || null };
    } catch {
      return { lyrics: null, source: null };
    }
  });
}

export async function related(videoId: string) {
  return cached(`related:${videoId}`, 30 * MIN, async () => {
    const client = await yt();
    try {
      const res: AnyNode = await client.music.getRelated(videoId);
      const contents: AnyNode[] = res?.contents ?? [];
      const sections = compact(contents.map(shelfToSection));
      const about = contents.find((c) => c.type === 'MusicDescriptionShelf');
      return { sections, about: about ? text(about.description) : null };
    } catch {
      return { sections: [] as Section[], about: null };
    }
  });
}

// ---------------------------------------------------------------------------
// Signed-in account features
// ---------------------------------------------------------------------------

export async function me() {
  const auth = loadAuth();
  if (!auth) return { signedIn: false as const };
  if (authBroken) return { signedIn: true as const, expired: true, account: auth.account ?? null };
  if (auth.account) return { signedIn: true as const, account: auth.account };
  return cached('me', 30 * MIN, async () => ({ signedIn: true as const, account: await readAccount(await yt()) }));
}

/** Personal endpoints need a working session; say why when there isn't one. */
function requireAccount() {
  if (!isSignedIn()) throw new Error('Not signed in to YouTube Music.');
  if (authBroken) throw new Error('Your YouTube Music session expired. Sign in again.');
}

/** The user's playlists from their YouTube Music library. */
export async function myPlaylists() {
  if (!isSignedIn() || authBroken) return { items: [] as Item[] };
  return cached('my-playlists', 5 * MIN, async () => {
    const client = await yt();
    const lib: AnyNode = await client.music.getLibrary();
    const items: Item[] = [];
    const collect = (n: AnyNode) => {
      const it = fromAny(n);
      if (it && (it.kind === 'playlist' || it.kind === 'album')) items.push(it);
    };
    for (const block of lib.contents ?? []) {
      for (const n of block.contents ?? block.items ?? []) collect(n);
    }
    // "New playlist" tiles and similar have no id and are dropped by fromAny.
    return { items: dedupe(items) };
  });
}

export async function likedSongs() {
  if (!isSignedIn() || authBroken) return { tracks: [] as Track[] };
  return cached('liked', 3 * MIN, async () => {
    const data = await playlist('LM');
    return { tracks: data.tracks };
  });
}

export async function rate(videoId: string, like: boolean) {
  requireAccount();
  const client = await yt();
  if (like) await client.interact.like(videoId);
  else await client.interact.removeRating(videoId);
  for (const k of [...cache.keys()]) if (k.endsWith('|liked') || k.includes('|playlist:LM')) cache.delete(k);
  return { ok: true };
}

/**
 * Reports a listen to YouTube so the account's watch history (and therefore
 * YouTube Music's recommendations) reflect what's played in Pulse.
 */
export async function addToHistory(videoId: string) {
  requireAccount();
  const client = await yt();
  const info: AnyNode = await client.music.getInfo(videoId);
  await info.addToWatchHistory();
  return { ok: true };
}

export async function addToYtPlaylist(playlistId: string, videoIds: string[]) {
  requireAccount();
  const client = await yt();
  await client.playlist.addVideos(playlistId, videoIds);
  for (const k of [...cache.keys()]) if (k.includes(`|playlist:${playlistId}`)) cache.delete(k);
  return { ok: true };
}
