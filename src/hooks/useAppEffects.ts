import { useEffect, useRef, useState } from 'react';
import { usePlayer, useCurrentTrack } from '../store/player';
import { useUI } from '../store/ui';
import { useLibrary } from '../store/library';
import { extractPalette, DEFAULT_PALETTE } from '../lib/color';
import { artistNames } from '../lib/format';
import { desktop } from '../lib/desktop';

/** Extracts the current artwork's palette and exposes it as CSS variables. */
export function useDynamicTheme() {
  const track = useCurrentTrack();
  const setPalette = useUI((s) => s.setPalette);
  useEffect(() => {
    let alive = true;
    extractPalette(track?.thumbnail).then((p) => {
      if (!alive) return;
      const palette = track ? p : DEFAULT_PALETTE;
      setPalette(palette);
      const root = document.documentElement.style;
      root.setProperty('--accent', palette.accent);
      root.setProperty('--tint-1', palette.colors[0]);
      root.setProperty('--tint-2', palette.colors[1]);
      root.setProperty('--tint-deep', palette.deep);
    });
    return () => {
      alive = false;
    };
  }, [track?.thumbnail, track, setPalette]);
}

/** Desktop app: applies the window glass material and how see-through the UI is. */
export function useDesktopGlass() {
  const glass = useLibrary((s) => s.settings.glass);
  const transparency = useLibrary((s) => s.settings.transparency);
  useEffect(() => {
    const root = document.documentElement;
    if (!desktop) {
      root.style.setProperty('--see', '0');
      return;
    }
    root.classList.add('desktop');
    void desktop.setMaterial(glass === 'solid' ? 'none' : glass);
    const see = glass === 'solid' ? 0 : Math.max(0, Math.min(1, transparency));
    root.style.setProperty('--see', String(see));
  }, [glass, transparency]);
}

/** Integrates with OS media keys, lock screens and the browser's media hub. */
export function useMediaSession() {
  const track = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (!track) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: artistNames(track),
      album: track.album?.name ?? '',
      artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '544x544', type: 'image/jpeg' }] : [],
    });
    document.title = `${track.title} • ${artistNames(track)}`;
  }, [track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const p = () => usePlayer.getState();
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    };
    set('play', () => p().play());
    set('pause', () => p().pause());
    set('nexttrack', () => p().next());
    set('previoustrack', () => p().prev());
    set('seekto', (d) => d.seekTime !== undefined && p().seek(d.seekTime));
    set('seekforward', () => p().seek(p().currentTime + 10));
    set('seekbackward', () => p().seek(Math.max(0, p().currentTime - 10)));
    return () => {
      (['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekforward', 'seekbackward'] as const).forEach((a) =>
        set(a, null),
      );
    };
  }, []);
}

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  return !!n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName));
};

/** Global keyboard shortcuts (YouTube Music–style). */
export function useShortcuts(focusSearch: () => void) {
  const focusRef = useRef(focusSearch);
  focusRef.current = focusSearch;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const p = usePlayer.getState();
      const ui = useUI.getState();
      const track = p.queue[p.index]?.track;
      const k = e.key;
      const handled = () => e.preventDefault();

      if (k === ' ' || k === 'k' || k === 'K') {
        // Let buttons handle their own Space activation.
        if (k === ' ' && (e.target as HTMLElement)?.closest('button, [role="slider"], a')) return;
        handled();
        p.toggle();
      } else if (k === 'ArrowRight' || k === 'l' || k === 'L') {
        if ((e.target as HTMLElement)?.closest('[role="slider"]')) return;
        handled();
        p.seek(Math.min(p.duration || Infinity, p.currentTime + (e.shiftKey ? 5 : 10)));
      } else if (k === 'ArrowLeft' || k === 'j' || k === 'J') {
        if ((e.target as HTMLElement)?.closest('[role="slider"]')) return;
        handled();
        p.seek(Math.max(0, p.currentTime - (e.shiftKey ? 5 : 10)));
      } else if (k === 'ArrowUp' && ui.nowPlaying) {
        handled();
        p.setVolume(p.volume + 5);
      } else if (k === 'ArrowDown' && ui.nowPlaying) {
        handled();
        p.setVolume(p.volume - 5);
      } else if (k === 'n' || k === 'N') {
        handled();
        p.next();
      } else if (k === 'p' || k === 'P') {
        handled();
        p.prev();
      } else if (k === 'm' || k === 'M') {
        handled();
        p.toggleMute();
      } else if (k === 's' || k === 'S') {
        handled();
        p.toggleShuffle();
      } else if (k === 'r' || k === 'R') {
        handled();
        p.cycleRepeat();
      } else if ((k === '+' || k === '=') && track) {
        handled();
        useLibrary.getState().toggleLike(track);
      } else if (k === 'f' || k === 'F') {
        handled();
        if (ui.nowPlaying) ui.closeNowPlaying();
        else if (track) ui.openNowPlaying();
      } else if (k === 'y' || k === 'Y') {
        if (track) {
          handled();
          ui.openNowPlaying('lyrics');
        }
      } else if (k === '/') {
        handled();
        focusRef.current();
      } else if (k === '?') {
        handled();
        ui.setShortcuts(!ui.shortcuts);
      } else if (k === 'Escape') {
        if (ui.menu) ui.closeMenu();
        else if (ui.shortcuts) ui.setShortcuts(false);
        else if (ui.nowPlaying) ui.closeNowPlaying();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Smoothly interpolates between color lists (for WebGL backgrounds). */
export function useTweenedColors(target: string[], ms = 900): string[] {
  const [colors, setColors] = useState(target);
  const fromRef = useRef<number[][] | null>(null);
  const currentRef = useRef(colors);
  currentRef.current = colors;
  const key = target.join('|');

  useEffect(() => {
    const parse = (c: string): number[] => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return [0, 0, 0];
      ctx.fillStyle = '#000';
      ctx.fillStyle = c;
      const hex = ctx.fillStyle as string;
      if (hex.startsWith('#')) return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const m = hex.match(/[\d.]+/g);
      return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
    };
    const from = currentRef.current.map(parse);
    const to = target.map(parse);
    while (from.length < to.length) from.push(from[from.length - 1] ?? [0, 0, 0]);
    fromRef.current = from;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setColors(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setColors(
        to.map((c, i) => {
          const f = from[i];
          const mix = c.map((v, j) => Math.round(f[j] + (v - f[j]) * e));
          return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
        }),
      );
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  return colors;
}
