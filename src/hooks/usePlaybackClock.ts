import { useEffect, useRef } from 'react';
import { engine } from '../lib/engine';
import { usePlayer } from '../store/player';

/**
 * Calls `onFrame(seconds)` every animation frame with a smooth playback time.
 *
 * The player is only polled ~4×/s; between polls we extrapolate with
 * performance.now() so time-synced UI (lyrics) moves continuously instead of
 * jumping in 250ms steps. Paused playback freezes the clock.
 */
export function usePlaybackClock(onFrame: (seconds: number) => void, enabled = true) {
  const cb = useRef(onFrame);
  cb.current = onFrame;

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let base = engine.time();
    let baseAt = performance.now();
    let lastPoll = 0;

    const frame = (now: number) => {
      const { isPlaying, buffering } = usePlayer.getState();
      if (now - lastPoll > 200) {
        lastPoll = now;
        const actual = engine.time();
        // Re-anchor on seeks or drift; ignore tiny jitter so motion stays smooth.
        const predicted = base + (isPlaying && !buffering ? (now - baseAt) / 1000 : 0);
        if (Math.abs(actual - predicted) > 0.12 || !isPlaying || buffering) {
          base = actual;
          baseAt = now;
        }
      }
      const t = isPlaying && !buffering ? base + (now - baseAt) / 1000 : base;
      if (!isPlaying || buffering) {
        base = t;
        baseAt = now;
      }
      cb.current(t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}
