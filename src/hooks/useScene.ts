import { useEffect, useState } from 'react';
import { extractPalette, DEFAULT_PALETTE, type Palette } from '../lib/color';
import { useUI } from '../store/ui';

/**
 * Extracts a palette from a page's artwork and publishes it as the app-wide
 * scene, so the whole window takes on that album/artist/playlist's colors.
 */
export function useScenePalette(key: string, src: string | undefined): Palette {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const setScene = useUI((s) => s.setScene);
  const clearScene = useUI((s) => s.clearScene);

  useEffect(() => {
    let alive = true;
    if (!src) return;
    extractPalette(src).then((p) => {
      if (!alive) return;
      setPalette(p);
      setScene({ key, colors: p.colors.slice(0, 3), art: src });
    });
    return () => {
      alive = false;
    };
  }, [key, src, setScene]);

  useEffect(() => () => clearScene(key), [key, clearScene]);
  return palette;
}
