import { useEffect } from 'react';
import { openChannel, type MiniState } from '../lib/sync';
import { desktop } from '../lib/desktop';
import { usePlayer } from '../store/player';
import { useLibrary } from '../store/library';
import { useUI } from '../store/ui';

/** Main window side: publishes player state and obeys mini-player commands. */
export function useMiniHost() {
  useEffect(() => {
    if (!desktop) return;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const snapshot = (): MiniState => {
      const p = usePlayer.getState();
      const track = p.queue[p.index]?.track ?? null;
      const palette = useUI.getState().palette;
      return {
        track,
        isPlaying: p.isPlaying,
        currentTime: p.currentTime,
        duration: p.duration,
        liked: track ? useLibrary.getState().isLiked(track.id) : false,
        accent: palette.accent,
        colors: palette.colors,
      };
    };

    const ch = openChannel((m) => {
      if (m.type !== 'command') return;
      const p = usePlayer.getState();
      const track = p.queue[p.index]?.track;
      switch (m.command.cmd) {
        case 'hello':
          break;
        case 'toggle':
          p.toggle();
          break;
        case 'next':
          p.next();
          break;
        case 'prev':
          p.prev();
          break;
        case 'like':
          if (track) useLibrary.getState().toggleLike(track);
          break;
        case 'seek':
          p.seek(m.command.value);
          break;
        case 'open-main':
          void desktop?.focusMain();
          break;
      }
      publish(true);
    });

    // Throttled to ~4 updates/s — the mini window interpolates in between.
    function publish(now = false) {
      const send = () => {
        last = Date.now();
        ch.post({ type: 'state', state: snapshot() });
      };
      clearTimeout(timer);
      const wait = now ? 0 : Math.max(0, 250 - (Date.now() - last));
      timer = setTimeout(send, wait);
    }

    const unsubs = [
      usePlayer.subscribe(() => publish()),
      useLibrary.subscribe((s, prev) => s.likes !== prev.likes && publish(true)),
      useUI.subscribe((s, prev) => s.palette !== prev.palette && publish(true)),
    ];
    publish(true);
    return () => {
      clearTimeout(timer);
      unsubs.forEach((u) => u());
      ch.close();
    };
  }, []);
}
