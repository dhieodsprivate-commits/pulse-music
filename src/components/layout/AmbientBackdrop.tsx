import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useCurrentTrack } from '../../store/player';
import { useUI } from '../../store/ui';
import { useLibrary } from '../../store/library';
import { sized } from '../../lib/format';
import { isDesktop } from '../../lib/desktop';

/** Each area of the app has its own light; pages with artwork override it. */
const ROUTE_SCENES: { test: RegExp; key: string; colors: string[] }[] = [
  { test: /^\/(explore|mood)/, key: 'explore', colors: ['#ff3d6e', '#ff9a5c', '#22d3ee'] },
  { test: /^\/library/, key: 'library', colors: ['#7c5cff', '#c026d3', '#4338ca'] },
  { test: /^\/search/, key: 'search', colors: ['#22d3ee', '#3b82f6', '#8b5cf6'] },
];

function usePreloaded(src: string | undefined) {
  const [shown, setShown] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) {
      setShown(undefined);
      return;
    }
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => alive && setShown(src);
    img.onerror = () => alive && setShown(undefined);
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return shown;
}

/**
 * Full-window ambience under the glass UI: palette light blobs plus a heavily
 * blurred, slowly drifting copy of the artwork. In the desktop app every layer
 * is scaled by `--see` (the transparency setting) so the real desktop shows
 * through the window's Acrylic/Mica material.
 *
 * Blur sits on a layer that never changes; only its wrapper's transform
 * animates, so the browser rasterizes the blur once and just moves it.
 */
export function AmbientBackdrop() {
  const { pathname } = useLocation();
  const track = useCurrentTrack();
  const palette = useUI((s) => s.palette);
  const scene = useUI((s) => s.scene);
  const nowPlaying = useUI((s) => s.nowPlaying);
  const motionOn = useLibrary((s) => s.settings.motionBackgrounds);
  const appBehind = useLibrary((s) => s.settings.appBehindNowPlaying);

  const { key, colors, art, artStrength } = useMemo(() => {
    if (scene) return { key: `page:${scene.key}:${scene.colors.join()}`, colors: scene.colors, art: scene.art, artStrength: 0.7 };
    const route = ROUTE_SCENES.find((r) => r.test.test(pathname));
    if (route) return { key: route.key, colors: route.colors, art: track?.thumbnail, artStrength: 0.28 };
    return { key: `track:${palette.colors.join()}`, colors: palette.colors, art: track?.thumbnail, artStrength: 0.62 };
  }, [scene, pathname, palette, track?.thumbnail]);

  const shown = usePreloaded(sized(art, 226));
  const [c1, c2, c3] = colors;

  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-300 ${
        // Now Playing paints its own background; stacking both would make it opaque
        // (unless the app is meant to show through it).
        nowPlaying && isDesktop && !appBehind ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Base: opaque in the browser, see-through in the desktop app. */}
      <div className="absolute inset-0" style={{ background: 'rgb(7 7 11 / calc(1 - var(--see)))' }} />

      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 55% at 12% 8%, ${c1} 0%, transparent 70%),
                radial-gradient(55% 50% at 92% 18%, ${c2} 0%, transparent 72%),
                radial-gradient(70% 60% at 60% 105%, ${c3 ?? c1} 0%, transparent 70%)`,
              opacity: 'calc(0.55 * (1 - var(--see) * 0.75))',
            }}
          />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key={shown}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          >
            <div
              className="absolute inset-0 transition-opacity duration-1000"
              style={{ opacity: `calc(${artStrength} * (1 - var(--see) * 0.85))` }}
            >
              <div className={`absolute -inset-[20%] will-change-transform ${motionOn ? 'ambient-drift' : ''}`}>
                <img
                  src={shown}
                  alt=""
                  draggable={false}
                  className="h-full w-full scale-110 object-cover [filter:blur(90px)_saturate(1.7)_brightness(0.9)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legibility: deepen toward the edges and the bottom where the player sits. */}
      <div
        className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_30%,rgba(7,7,11,0.2)_0%,rgba(7,7,11,0.68)_70%,rgba(7,7,11,0.88)_100%)]"
        style={{ opacity: 'calc(1 - var(--see))' }}
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,11,0)_55%,rgba(7,7,11,0.55)_100%)]"
        style={{ opacity: 'calc(1 - var(--see) * 0.85)' }}
      />
    </div>
  );
}
