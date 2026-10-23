/**
 * Vite plugin that mounts the music API under /api on both the dev server
 * and `vite preview`, so the whole app runs from a single command.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import * as ytm from './ytm.ts';
import { cleanTitle, getLyrics } from './lyrics.ts';
import * as auth from './auth.ts';
import type { Item, Section, Track } from './ytm.ts';

type Handler = (params: Record<string, string>, query: URLSearchParams) => Promise<unknown>;

const isTrack = (i: Item): i is Track => i.kind === 'song' || i.kind === 'video';
const ID = /^[\w-]{3,80}$/;

const routes: [RegExp, Handler][] = [
  [/^\/health$/, async () => ({ ok: true, app: 'pulse' })],
  [/^\/home$/, (_p, q) => ytm.home(q.get('mood') || undefined)],
  [/^\/explore$/, () => ytm.explore()],
  [
    /^\/search$/,
    (_p, q) => {
      const type = (q.get('type') ?? 'all') as ytm.SearchFilter;
      const allowed: ytm.SearchFilter[] = ['all', 'song', 'video', 'album', 'artist', 'playlist'];
      return ytm.search(q.get('q') ?? '', allowed.includes(type) ? type : 'all');
    },
  ],
  [/^\/suggest$/, (_p, q) => ytm.suggest(q.get('q') ?? '')],
  [/^\/album\/(?<id>[^/]+)$/, (p) => ytm.album(p.id)],
  [/^\/playlist\/(?<id>[^/]+)$/, (p) => ytm.playlist(p.id)],
  [/^\/artist\/(?<id>[^/]+)$/, (p) => ytm.artist(p.id)],
  [/^\/upnext\/(?<id>[^/]+)$/, (p, q) => ytm.upNext(p.id, q.get('list') || undefined)],
  [/^\/related\/(?<id>[^/]+)$/, (p) => ytm.related(p.id)],
  [
    /^\/lyrics\/(?<id>[^/]+)$/,
    (p, q) =>
      getLyrics({
        id: p.id,
        title: q.get('title') ?? undefined,
        artist: q.get('artist') ?? undefined,
        album: q.get('album') ?? undefined,
        duration: Number(q.get('duration')) || undefined,
      }),
  ],
  [
    // Finds another upload of the same song when the original refuses embedding.
    /^\/alt$/,
    async (_p, q) => {
      const title = q.get('title') ?? '';
      const artist = q.get('artist') ?? '';
      const exclude = new Set((q.get('exclude') ?? '').split(',').filter(Boolean));
      const query = `${title} ${artist}`.trim();
      if (!query) return { track: null };
      const [songs, videos] = await Promise.all([
        ytm.search(query, 'song').catch(() => ({ top: null, items: [] as Item[] })),
        ytm.search(`${query} audio`, 'video').catch(() => ({ top: null, items: [] as Item[] })),
      ]);
      // Only accept uploads of the *same* song: matching title and a shared artist.
      const norm = (s: string) =>
        cleanTitle(s)
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim();
      const want = norm(title);
      const wantArtist = artist.toLowerCase();
      const artistPrefix = `${norm(artist)} `;
      const pool = [...songs.items, ...videos.items]
        .filter(isTrack)
        .filter((t) => !exclude.has(t.id))
        .filter((t) => {
          // "Artist - Song (Official Audio)" → "song"
          const raw = norm(t.title);
          const got = artistPrefix.trim() && raw.startsWith(artistPrefix) ? raw.slice(artistPrefix.length) : raw;
          const titleOk = !!want && (got === want || got.startsWith(`${want} `) || want.startsWith(`${got} `));
          const artistOk =
            !wantArtist ||
            t.artists.some((a) => a.name.toLowerCase().includes(wantArtist) || wantArtist.includes(a.name.toLowerCase())) ||
            t.title.toLowerCase().includes(wantArtist);
          return titleOk && artistOk;
        });
      return { track: pool[0] ?? null, candidates: pool.slice(0, 5) };
    },
  ],
  [
    /^\/recommend$/,
    async (_p, q) => {
      const seeds = (q.get('seeds') ?? '').split(',').filter((s) => ID.test(s)).slice(0, 4);
      const results = await Promise.all(seeds.map((s) => ytm.related(s).catch(() => ({ sections: [] as Section[], about: null }))));
      const bySeed = results.map((r, i) => ({ seed: seeds[i], sections: r.sections }));
      const pick = (sections: Section[], re: RegExp) => sections.find((s) => re.test(s.title))?.items ?? [];

      // Interleave each seed's "You might also like" so no single seed dominates.
      const lists = bySeed.map((b) => pick(b.sections, /might also like/i).filter(isTrack));
      const quick: Track[] = [];
      const seen = new Set(seeds);
      for (let i = 0; quick.length < 24 && lists.some((l) => i < l.length); i++) {
        for (const l of lists) {
          const t = l[i];
          if (t && !seen.has(t.id)) {
            seen.add(t.id);
            quick.push(t);
          }
        }
      }
      const merge = (re: RegExp) => {
        const out: Item[] = [];
        const ids = new Set<string>();
        for (const b of bySeed) for (const it of pick(b.sections, re)) if (!ids.has(it.id)) (ids.add(it.id), out.push(it));
        return out;
      };
      return {
        quickPicks: quick,
        artists: merge(/similar artists|fans might also like/i),
        playlists: merge(/recommended playlists|playlists/i),
        because: bySeed.map((b) => ({ seed: b.seed, items: pick(b.sections, /might also like/i).slice(0, 12) })),
      };
    },
  ],
];

// Account endpoints that read personal data.
routes.push(
  [/^\/auth\/status$/, () => ytm.me().catch(() => ({ signedIn: ytm.isSignedIn() }))],
  [/^\/me\/playlists$/, () => ytm.myPlaylists()],
  [/^\/me\/liked$/, () => ytm.likedSongs()],
);

type Action = (body: Record<string, unknown>) => Promise<unknown>;
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.length <= max ? v : '');

/** State-changing endpoints (POST only, same-origin only). */
const actions: [RegExp, Action][] = [
  [
    /^\/auth\/cookie$/,
    async (b) => {
      const result = await auth.connectCookie(str(b.cookie, 20_000));
      if (result.ok) ytm.onAuthChanged();
      return result;
    },
  ],
  [
    /^\/auth\/logout$/,
    async () => {
      auth.clearAuth();
      ytm.onAuthChanged();
      return { ok: true };
    },
  ],
  [
    /^\/me\/rate$/,
    async (b) => {
      const id = str(b.id, 80);
      if (!ID.test(id)) throw new HttpError(400, 'Invalid id');
      return ytm.rate(id, b.like === true);
    },
  ],
  [
    /^\/me\/history$/,
    async (b) => {
      const id = str(b.id, 80);
      if (!ID.test(id)) throw new HttpError(400, 'Invalid id');
      return ytm.addToHistory(id);
    },
  ],
  [
    /^\/me\/playlist-add$/,
    async (b) => {
      const playlistId = str(b.playlistId, 80);
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, 200) : [];
      if (!ID.test(playlistId) || !ids.length) throw new HttpError(400, 'Invalid playlist or tracks');
      return ytm.addToYtPlaylist(playlistId, ids);
    },
  ],
];

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readJson(req: IncomingMessage, limit = 64 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' ? v : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Blocks other websites from driving this local server (CSRF). */
function sameOrigin(req: IncomingMessage): boolean {
  if (req.headers['x-pulse'] !== '1') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return (o.hostname === 'localhost' || o.hostname === '127.0.0.1') && o.host === req.headers.host;
  } catch {
    return false;
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(json);
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();
  const path = url.pathname.slice(4);

  if (req.method === 'POST') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Forbidden' });
    const action = actions.find(([re]) => re.test(path));
    if (!action) return send(res, 404, { error: 'Not found' });
    try {
      const body = await readJson(req);
      return send(res, 200, await action[1](body));
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 502;
      const message = err instanceof Error ? err.message : String(err);
      if (status >= 500) console.error(`[api] POST ${path} failed:`, message);
      return send(res, status, { error: message });
    }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  for (const [re, fn] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(
      Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
    );
    if (params.id !== undefined && !ID.test(params.id)) return send(res, 400, { error: 'Invalid id' });
    try {
      return send(res, 200, await fn(params, url.searchParams));
    } catch (first) {
      // Sessions occasionally go stale; one fresh retry fixes nearly all of these.
      ytm.resetSession();
      // A signed-in request YouTube rejects outright usually means the saved
      // session expired: serve anonymous data and flag it so the UI can ask.
      const firstMsg = first instanceof Error ? first.message : String(first);
      if (ytm.isSignedIn() && !ytm.isAuthBroken() && /status code 40[013]/.test(firstMsg)) {
        try {
          const value = await ytm.runAnonymously(() => fn(params, url.searchParams));
          ytm.markAuthBroken();
          return send(res, 200, value);
        } catch {
          /* not an auth problem; fall through to the normal retry */
        }
      }
      try {
        return send(res, 200, await fn(params, url.searchParams));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err ?? first);
        console.error(`[api] ${path} failed:`, message);
        return send(res, 502, { error: message });
      }
    }
  }
  return send(res, 404, { error: 'Not found' });
}

export function musicApi(): Plugin {
  const mount = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      handle(req, res, next).catch((err) => send(res, 500, { error: String(err) }));
    });
  };
  return {
    name: 'pulse-music-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
