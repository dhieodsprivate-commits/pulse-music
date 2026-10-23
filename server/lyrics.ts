/**
 * Lyrics resolution: time-synced lyrics from LRCLIB when available,
 * otherwise the plain lyrics YouTube Music ships for the track.
 */
import { lyrics as ytmLyrics } from './ytm.ts';

export interface LyricLine {
  /** Start time in seconds. */
  t: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricLine[] | null;
  plain: string | null;
  source: string | null;
}

const UA = 'PulseMusic/1.0 (local desktop app; https://github.com/)';

const cache = new Map<string, LyricsResult>();

/** Strips video-title noise so LRCLIB can match the canonical track name. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([](official|lyric|lyrics|audio|video|music video|visualizer|hd|4k|mv|m\/v|live)[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([](feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(remaster(ed)?|\d{4} remaster).*$/i, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3].padEnd(3, '0')) / 1000 : 0;
      lines.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  lines.sort((a, b) => a.t - b.t);
  // Collapse runs of empty lines so instrumental gaps show as a single pause.
  return lines.filter((l, i) => l.text || (i > 0 && lines[i - 1].text));
}

async function lrclib(path: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://lrclib.net/api/${path}`, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getLyrics(opts: {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}): Promise<LyricsResult> {
  const hit = cache.get(opts.id);
  if (hit) return hit;

  let result: LyricsResult = { synced: null, plain: null, source: null };
  const title = opts.title ? cleanTitle(opts.title) : '';
  const artist = opts.artist?.split(/,|&| x | feat\.? /i)[0]?.trim() ?? '';

  if (title && artist) {
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (opts.album) params.set('album_name', opts.album);
    if (opts.duration) params.set('duration', String(Math.round(opts.duration)));
    let rec = await lrclib(`get?${params}`);

    if (!rec?.syncedLyrics) {
      // Fuzzy search fallback; pick the closest duration that has synced lines.
      const list = await lrclib(`search?${new URLSearchParams({ track_name: title, artist_name: artist })}`);
      if (Array.isArray(list) && list.length) {
        const scored = list
          .filter((r: any) => r.syncedLyrics || r.plainLyrics)
          .map((r: any) => ({
            r,
            score:
              (r.syncedLyrics ? 0 : 1000) +
              (opts.duration && r.duration ? Math.abs(r.duration - opts.duration) : 30),
          }))
          .filter((x: any) => !opts.duration || x.score % 1000 < 12)
          .sort((a: any, b: any) => a.score - b.score);
        if (scored[0]) rec = scored[0].r;
      }
    }
    if (rec && !rec.instrumental) {
      const synced = rec.syncedLyrics ? parseLrc(rec.syncedLyrics) : null;
      result = {
        synced: synced && synced.length > 3 ? synced : null,
        plain: rec.plainLyrics ?? null,
        source: 'LRCLIB',
      };
    }
  }

  if (!result.synced && !result.plain) {
    const yt = await ytmLyrics(opts.id).catch(() => ({ lyrics: null, source: null }));
    if (yt.lyrics) result = { synced: null, plain: yt.lyrics, source: yt.source?.replace(/^Source:\s*/i, '') ?? 'YouTube Music' };
  }

  cache.set(opts.id, result);
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return result;
}
