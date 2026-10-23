/**
 * YouTube Music account connection via a real web session (cookies) — the
 * same thing music.youtube.com uses. Google rejects TV/device OAuth tokens for
 * web clients, so cookies are the only way to get the music endpoints.
 *
 * In the desktop app the cookies come from an isolated sign-in window (you
 * sign in on Google's own page); in a browser they can be pasted manually.
 * They are stored only on this machine in `.auth/account.json`.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Innertube } from 'youtubei.js';

export interface StoredAuth {
  method: 'cookie';
  cookie: string;
  account?: Account | null;
}

export interface Account {
  name: string;
  handle?: string;
  photo?: string;
}

// Anchored to the project folder, independent of the launch directory.
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.auth');
const FILE = path.join(DIR, 'account.json');

export function loadAuth(): StoredAuth | null {
  try {
    if (!existsSync(FILE)) return null;
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    if (data?.method === 'cookie' && typeof data.cookie === 'string' && data.cookie) return data;
    return null; // anything else (e.g. an old device-sign-in token) is ignored
  } catch {
    return null;
  }
}

function saveAuth(auth: StoredAuth) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export function clearAuth() {
  rmSync(FILE, { force: true });
}

/** An InnerTube session for the stored account, or anonymous. */
export async function createSession(auth: StoredAuth | null = loadAuth()): Promise<Innertube> {
  if (auth) return Innertube.create({ cookie: auth.cookie, retrieve_player: false });
  return Innertube.create({ retrieve_player: false, generate_session_locally: true });
}

/** Walks the account menu response for the signed-in user's name and photo. */
export async function readAccount(yt: Innertube): Promise<Account | null> {
  try {
    const info: any = await yt.account.getInfo();
    let found: Account | null = null;
    const seen = new Set<unknown>();
    const walk = (n: any) => {
      if (!n || typeof n !== 'object' || seen.has(n) || found) return;
      seen.add(n);
      if (n.account_name) {
        const thumbs = n.account_photo?.thumbnails ?? n.account_photo ?? [];
        const photo = Array.isArray(thumbs) ? [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url : undefined;
        found = { name: n.account_name.toString(), handle: n.channel_handle?.toString?.() || undefined, photo };
        return;
      }
      for (const v of Object.values(n)) walk(v);
    };
    walk(info);
    return found;
  } catch {
    return null;
  }
}

/** Keep only `name=value` pairs; drop attributes, blank lines and a leading "cookie:". */
function normalizeCookie(raw: string): string {
  return raw
    .replace(/^\s*cookie:\s*/i, '')
    .split(/;\s*|\r?\n/)
    .map((p) => p.trim())
    .filter((p) => /^[^=\s]+=/.test(p))
    .join('; ');
}

/**
 * Validates a cookie by actually calling YouTube Music with it (the library
 * endpoint only answers for a signed-in user), then stores it.
 */
export async function connectCookie(
  raw: string,
): Promise<{ ok: true; account: Account | null } | { ok: false; error: string }> {
  const cookie = normalizeCookie(raw);
  if (!/(^|;\s*)(SAPISID|__Secure-3PAPISID)=/.test(cookie)) {
    return { ok: false, error: "That doesn't look like a signed-in YouTube cookie (SAPISID is missing)." };
  }
  try {
    const yt = await createSession({ method: 'cookie', cookie });
    await yt.music.getLibrary();
    const account = await readAccount(yt);
    if (!account) return { ok: false, error: "YouTube didn't recognise that session. Sign in on music.youtube.com and try again." };
    saveAuth({ method: 'cookie', cookie, account });
    return { ok: true, account };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: /status code 40[013]/.test(msg) ? 'YouTube Music rejected that session — it may have expired.' : msg };
  }
}
