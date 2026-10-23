/**
 * Pulse desktop shell.
 *
 * Runs the music server (Vite + /api plugin) inside the Electron main process
 * and shows the UI in a frameless window whose background is real Windows 11
 * glass (Acrylic / Mica), so the desktop shows through the translucent UI.
 */
import { app, BrowserWindow, ipcMain, nativeTheme, screen, session, shell } from 'electron';
import { existsSync, readFileSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
// Fixed port: the renderer's localStorage (your library) is scoped to this origin.
const PORT = 47823;
const ORIGIN = `http://localhost:${PORT}`;
const DEV = process.argv.includes('--dev');
const MATERIALS = new Set(['acrylic', 'mica', 'none']);

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// YouTube's embedded player is happiest with a plain Chrome user agent.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|pulse-music)\/[\w.-]+/g, '');
app.setAppUserModelId('Pulse.Music');
nativeTheme.themeSource = 'dark';

// ---------------------------------------------------------------------------
// Small persisted state (window bounds + glass material)
// ---------------------------------------------------------------------------

const statePath = path.join(app.getPath('userData'), 'window-state.json');
function readState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}
function writeState(patch) {
  try {
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ ...readState(), ...patch }, null, 2));
  } catch {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function isPulseRunning() {
  try {
    const res = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1500) });
    const body = await res.json();
    return body?.app === 'pulse';
  } catch {
    return false;
  }
}

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

function needsBuild() {
  const dist = path.join(root, 'dist', 'index.html');
  if (!existsSync(dist)) return true;
  const built = statSync(dist).mtimeMs;
  const sources = ['src', 'server', 'public'].map((d) => newestMtime(path.join(root, d)));
  sources.push(statSync(path.join(root, 'index.html')).mtimeMs);
  return Math.max(...sources) > built;
}

let server = null;

async function startServer(onStatus) {
  if (await isPulseRunning()) return; // e.g. a dev server you already started
  const vite = await import('vite');
  if (DEV) {
    server = await vite.createServer({ root, configFile: path.join(root, 'vite.config.ts'), server: { port: PORT, strictPort: true } });
    await server.listen();
    return;
  }
  if (needsBuild()) {
    onStatus('Polishing the glass… (first launch after an update takes a few seconds)');
    await vite.build({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'error' });
  }
  server = await vite.preview({ root, configFile: path.join(root, 'vite.config.ts'), preview: { port: PORT, strictPort: true } });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

let win = null;
let mini = null;

const splash = (msg) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><html><head><style>
    html,body{margin:0;height:100%;background:transparent;font-family:'Segoe UI Variable','Segoe UI',sans-serif;color:#f4f3f8}
    body{display:grid;place-items:center}
    .c{text-align:center}
    .logo{width:72px;height:72px;margin:0 auto 18px;border-radius:20px;background:linear-gradient(135deg,#ff3d6e,#7c5cff);
      display:grid;place-items:center;box-shadow:0 20px 60px -10px #ff3d6e;animation:p 1.6s ease-in-out infinite}
    .logo:after{content:'';margin-left:6px;border-left:22px solid #fff;border-top:14px solid transparent;border-bottom:14px solid transparent}
    p{opacity:.7;font-size:14px}
    @keyframes p{50%{transform:scale(1.06)}}
  </style></head><body><div class="c"><div class="logo"></div><div style="font-size:22px;font-weight:700">Pulse</div><p>${msg}</p></div></body></html>`);

function material() {
  const m = readState().material;
  return MATERIALS.has(m) ? m : 'acrylic';
}

function createWindow() {
  const state = readState();
  const area = screen.getPrimaryDisplay().workAreaSize;
  let bounds = state.bounds ?? { width: Math.min(1440, area.width - 80), height: Math.min(920, area.height - 60) };
  // Saved bounds can point off-screen (monitor unplugged, resolution changed): pull them back in.
  if (Number.isFinite(bounds.x) && Number.isFinite(bounds.y)) {
    const work = screen.getDisplayMatching(bounds).workArea;
    const width = Math.min(bounds.width, work.width);
    const height = Math.min(bounds.height, work.height);
    bounds = {
      width,
      height,
      x: Math.min(Math.max(bounds.x, work.x), work.x + work.width - width),
      y: Math.min(Math.max(bounds.y, work.y), work.y + work.height - height),
    };
  }

  win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'Pulse',
    icon: path.join(root, 'public', 'pulse.ico'),
    backgroundColor: '#00000000',
    backgroundMaterial: material(),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#f4f3f8', height: 44 },
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Keep the player's timers alive when minimized so tracks keep advancing.
      backgroundThrottling: false,
    },
  });
  if (state.maximized) win.maximize();

  win.once('ready-to-show', () => win.show());
  const save = () => {
    if (!win || win.isDestroyed()) return;
    writeState({ maximized: win.isMaximized(), ...(win.isMaximized() || win.isMinimized() ? {} : { bounds: win.getBounds() }) });
  };
  win.on('resize', save);
  win.on('move', save);
  win.on('close', save);
  win.on('closed', () => {
    win = null;
    if (mini && !mini.isDestroyed()) mini.close();
  });

  // Anything outside the app opens in the user's real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  return win;
}

function openMini() {
  if (mini && !mini.isDestroyed()) {
    mini.show();
    mini.focus();
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const saved = readState().miniBounds;
  mini = new BrowserWindow({
    width: 380,
    height: 132,
    x: saved?.x ?? area.x + area.width - 400,
    y: saved?.y ?? area.y + area.height - 152,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    show: false,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    roundedCorners: true,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  mini.setAlwaysOnTop(true, 'floating');
  mini.loadURL(`${ORIGIN}/mini`);
  mini.once('ready-to-show', () => mini.show());
  mini.on('moved', () => writeState({ miniBounds: mini.getBounds() }));
  mini.on('closed', () => (mini = null));
}

// ---------------------------------------------------------------------------
// YouTube Music account: sign in on Google's own page in an isolated window,
// then hand the resulting music.youtube.com session to the local server.
// ---------------------------------------------------------------------------

const LOGIN_PARTITION = 'persist:pulse-google';
const loginSession = () => session.fromPartition(LOGIN_PARTITION);
const SIGNIN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&continue=' +
  encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&app=desktop&next=https%3A%2F%2Fmusic.youtube.com%2F');

async function cookieHeader() {
  const cookies = await loginSession().cookies.get({ url: 'https://music.youtube.com' });
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

const hasSignedInCookie = (cookie) => /(^|;\s*)(SAPISID|__Secure-3PAPISID)=/.test(cookie);

async function pushSessionToServer() {
  const cookie = await cookieHeader();
  if (!hasSignedInCookie(cookie)) return { ok: false, error: 'Not signed in yet.' };
  const res = await fetch(`${ORIGIN}/api/auth/cookie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pulse': '1' },
    body: JSON.stringify({ cookie }),
  });
  return res.json();
}

let loginWindow = null;

function googleLogin() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return Promise.resolve({ ok: false, error: 'Sign-in is already open.' });
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
    };
    loginWindow = new BrowserWindow({
      width: 480,
      height: 720,
      parent: win ?? undefined,
      title: 'Sign in to YouTube Music',
      autoHideMenuBar: true,
      backgroundColor: '#101016',
      icon: path.join(root, 'public', 'pulse.ico'),
      webPreferences: { partition: LOGIN_PARTITION, contextIsolation: true, sandbox: true },
    });
    const wc = loginWindow.webContents;
    // Keep Google's popups (help, account chooser) inside this window.
    wc.setWindowOpenHandler(({ url }) => {
      void wc.loadURL(url);
      return { action: 'deny' };
    });
    let redirected = false;
    const check = async (url) => {
      if (!/^https:\/\/music\.youtube\.com\//.test(url)) return;
      const result = await pushSessionToServer().catch((err) => ({ ok: false, error: String(err?.message ?? err) }));
      if (result.ok) finish(result);
      else if (/Not signed in/.test(result.error ?? '')) {
        // Landed on YouTube Music signed out: send them to Google once; after
        // that let them use YouTube Music's own "Sign in" button (no loops).
        if (!redirected) {
          redirected = true;
          void wc.loadURL(SIGNIN_URL);
        }
      } else finish(result);
    };
    wc.on('did-navigate', (_e, url) => void check(url));
    wc.on('did-navigate-in-page', (_e, url) => void check(url));
    loginWindow.on('closed', () => {
      loginWindow = null;
      finish({ ok: false, error: 'Sign-in was closed.' });
    });
    void loginWindow.loadURL(SIGNIN_URL);
  });
}

/**
 * YouTube rotates some session cookies; visiting music.youtube.com in the
 * sign-in session refreshes them, and we pass the fresh set to the server.
 */
async function refreshAccountSession() {
  try {
    if (!hasSignedInCookie(await cookieHeader())) return;
    const status = await fetch(`${ORIGIN}/api/auth/status`).then((r) => r.json());
    if (!status?.signedIn) return; // signed out in Pulse — don't resurrect it
    const hidden = new BrowserWindow({ show: false, webPreferences: { partition: LOGIN_PARTITION, sandbox: true } });
    await Promise.race([hidden.loadURL('https://music.youtube.com/'), new Promise((r) => setTimeout(r, 20000))]).catch(() => {});
    hidden.destroy();
    await pushSessionToServer();
  } catch (err) {
    console.warn('[account] refresh failed:', err?.message ?? err);
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle('pulse:get-material', () => material());
ipcMain.handle('pulse:set-material', (_e, m) => {
  if (!MATERIALS.has(m)) return material();
  writeState({ material: m });
  win?.setBackgroundMaterial(m);
  return m;
});
ipcMain.handle('pulse:title-bar', (_e, opts) => {
  if (!win || process.platform !== 'win32') return;
  win.setTitleBarOverlay({
    color: '#00000000',
    symbolColor: typeof opts?.symbolColor === 'string' ? opts.symbolColor : '#f4f3f8',
    height: 44,
  });
});
ipcMain.handle('pulse:mini', (_e, show) => {
  if (show === false) mini?.close();
  else openMini();
});
ipcMain.handle('pulse:google-login', () => googleLogin());
ipcMain.handle('pulse:google-logout', async () => {
  await loginSession().clearStorageData();
  return { ok: true };
});
ipcMain.handle('pulse:focus-main', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  void server?.close?.();
});

app.whenReady().then(async () => {
  const w = createWindow();
  await w.loadURL(splash('Starting up…'));
  try {
    await startServer((msg) => w.loadURL(splash(msg)));
    await w.loadURL(ORIGIN);
    void refreshAccountSession();
    setInterval(() => void refreshAccountSession(), 6 * 60 * 60 * 1000);
  } catch (err) {
    console.error(err);
    await w.loadURL(splash(`Couldn't start: ${String(err?.message ?? err).replace(/[<>]/g, '')}`));
  }
});
