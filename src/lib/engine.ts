/**
 * Thin, promise-safe wrapper around the YouTube IFrame Player API.
 *
 * The player lives in a single persistent <div> for the lifetime of the app
 * (moving an iframe in the DOM reloads it), and the rest of the app talks to
 * it exclusively through this singleton.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PlayerState = {
  Unstarted: -1,
  Ended: 0,
  Playing: 1,
  Paused: 2,
  Buffering: 3,
  Cued: 5,
} as const;
export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

export interface EngineEvents {
  state: (s: PlayerState) => void;
  error: (code: number) => void;
  ready: () => void;
}

let apiPromise: Promise<any> | null = null;

function loadApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => {
        apiPromise = null;
        s.remove();
        reject(new Error('Could not load the YouTube player. Check your connection.'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

class Engine {
  private player: any = null;
  private ready = false;
  private pending: (() => void)[] = [];
  private listeners: { [K in keyof EngineEvents]: Set<EngineEvents[K]> } = {
    state: new Set(),
    error: new Set(),
    ready: new Set(),
  };
  private volume = 80;
  private muted = false;

  private attaching: Promise<void> | null = null;
  private hostEl: HTMLDivElement | null = null;

  /**
   * The player's container. It lives directly on <body>, outside React, so no
   * re-render or hot reload can ever detach (and silently break) the iframe.
   */
  get host(): HTMLDivElement {
    if (!this.hostEl) {
      let el = document.getElementById('pulse-player-host') as HTMLDivElement | null;
      if (el) el.replaceChildren();
      else {
        el = document.createElement('div');
        el.id = 'pulse-player-host';
        el.setAttribute('aria-hidden', 'true');
        el.className =
          'fixed top-0 left-0 z-[60] overflow-hidden bg-black transition-opacity duration-300 pointer-events-none [&_iframe]:h-full [&_iframe]:w-full';
        Object.assign(el.style, { transform: 'translate3d(-200vw, 0, 0)', width: '480px', height: '270px', opacity: '0' });
        document.body.appendChild(el);
      }
      this.hostEl = el;
    }
    return this.hostEl;
  }

  attach(): Promise<void> {
    if (!this.attaching) {
      this.attaching = this.create(this.host).catch((err) => {
        this.attaching = null;
        throw err;
      });
    }
    return this.attaching;
  }

  private async create(el: HTMLElement) {
    const YT = await loadApi();
    const mount = document.createElement('div');
    el.appendChild(mount);
    this.player = new YT.Player(mount, {
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          this.ready = true;
          this.player.setVolume(this.volume);
          if (this.muted) this.player.mute();
          const queued = this.pending;
          this.pending = [];
          queued.forEach((fn) => fn());
          this.listeners.ready.forEach((fn) => fn());
        },
        onStateChange: (e: { data: PlayerState }) => this.listeners.state.forEach((fn) => fn(e.data)),
        onError: (e: { data: number }) => this.listeners.error.forEach((fn) => fn(e.data)),
      },
    });
  }

  on<K extends keyof EngineEvents>(event: K, fn: EngineEvents[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private run(fn: () => void) {
    if (this.ready) {
      try {
        fn();
      } catch (err) {
        console.warn('[engine]', err);
      }
    } else {
      this.pending.push(fn);
    }
  }

  load(videoId: string, start = 0, autoplay = true) {
    // Collapse queued loads so only the latest request wins before ready.
    if (!this.ready) this.pending = this.pending.filter((f) => !(f as any).__load);
    const fn = () =>
      autoplay
        ? this.player.loadVideoById({ videoId, startSeconds: start })
        : this.player.cueVideoById({ videoId, startSeconds: start });
    (fn as any).__load = true;
    this.run(fn);
  }

  play() {
    this.run(() => this.player.playVideo());
  }

  pause() {
    this.run(() => this.player.pauseVideo());
  }

  stop() {
    this.run(() => this.player.stopVideo());
  }

  seek(seconds: number) {
    this.run(() => this.player.seekTo(Math.max(0, seconds), true));
  }

  setVolume(v: number) {
    this.volume = Math.round(Math.max(0, Math.min(100, v)));
    this.run(() => this.player.setVolume(this.volume));
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.run(() => (m ? this.player.mute() : this.player.unMute()));
  }

  time(): number {
    if (!this.ready) return 0;
    try {
      return this.player.getCurrentTime?.() ?? 0;
    } catch {
      return 0;
    }
  }

  duration(): number {
    if (!this.ready) return 0;
    try {
      return this.player.getDuration?.() ?? 0;
    } catch {
      return 0;
    }
  }

  loadedFraction(): number {
    if (!this.ready) return 0;
    try {
      return this.player.getVideoLoadedFraction?.() ?? 0;
    } catch {
      return 0;
    }
  }
}

export const engine = new Engine();
