import type { Collection, Item, Track } from './types';

export function formatTime(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function formatTotal(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h) return `${h} hr ${m} min`;
  return `${m} min`;
}

export const artistNames = (t: Pick<Track, 'artists'>) => t.artists.map((a) => a.name).join(', ') || 'Unknown artist';

export function itemSubtitle(i: Item): string {
  if (i.kind === 'song' || i.kind === 'video') {
    const parts = [i.kind === 'video' ? 'Video' : 'Song', artistNames(i)];
    if (i.views) parts.push(i.views);
    return parts.join(' • ');
  }
  return (i as Collection).subtitle ?? (i.kind === 'artist' ? 'Artist' : i.kind === 'album' ? 'Album' : 'Playlist');
}

export function itemHref(i: Item): string | null {
  switch (i.kind) {
    case 'album':
      return `/album/${i.id}`;
    case 'playlist':
      return `/playlist/${i.id}`;
    case 'artist':
      return `/artist/${i.id}`;
    default:
      return null;
  }
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ytmUrl = (t: Track) => `https://music.youtube.com/watch?v=${t.id}`;

export function relativeDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' });
}

/**
 * Picks a standard square size for Google-hosted art. Only sizes YouTube Music
 * itself requests are used — they're CDN-cached, while arbitrary sizes get
 * resized on demand and rate-limited (HTTP 429).
 */
export function sized(url: string | undefined, px: number): string | undefined {
  if (!url || !/(googleusercontent\.com|ggpht\.com)/.test(url)) return url;
  const s = [60, 120, 226, 544].find((v) => v >= px) ?? 544;
  return url.replace(/=w(\d+)-h\1(-p)?-l90-rj$/, `=w${s}-h${s}$2-l90-rj`);
}
