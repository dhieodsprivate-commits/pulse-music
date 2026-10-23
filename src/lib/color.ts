/**
 * Extracts a small, display-ready palette from artwork. Album art CDNs send
 * `Access-Control-Allow-Origin: *`, so the canvas stays untainted.
 */
import { sized } from './format';

export interface Palette {
  /** Vivid accent, lightened enough to read on a dark UI. */
  accent: string;
  /** Up to four colors for animated gradients. */
  colors: string[];
  /** Very dark tone for page backgrounds. */
  deep: string;
}

export const DEFAULT_PALETTE: Palette = {
  accent: '#ff4f7b',
  colors: ['#ff3d6e', '#7c5cff', '#1fb6ff', '#2a0f3d'],
  deep: '#0d0a14',
};

const cache = new Map<string, Palette>();

type RGB = [number, number, number];

function rgbToHsl([r, g, b]: RGB): RGB {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)}, ${Math.round(Math.min(1, s) * 100)}%, ${Math.round(Math.min(1, l) * 100)}%)`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    img.src = src;
  });
}

export async function extractPalette(src: string | undefined): Promise<Palette> {
  if (!src) return DEFAULT_PALETTE;
  const hit = cache.get(src);
  if (hit) return hit;
  try {
    // A small, CDN-cached variant is plenty for a 40×40 color sample.
    const img = await loadImage(sized(src, 120) ?? src);
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;
    // Center-crop so 16:9 video thumbnails don't sample their letterbox bars.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Bucket pixels by hue (12 buckets) and keep weighted averages.
    const buckets = Array.from({ length: 12 }, () => ({ w: 0, h: 0, s: 0, l: 0 }));
    let grayW = 0;
    let grayL = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = rgbToHsl([data[i], data[i + 1], data[i + 2]]);
      if (s < 0.14 || l < 0.07 || l > 0.95) {
        grayW += 1;
        grayL += l;
        continue;
      }
      // Favor saturated, mid-light pixels — the "colorful" parts of the art.
      const w = s * (1 - Math.abs(l - 0.5) * 1.4);
      const b = buckets[Math.floor(h / 30) % 12];
      b.w += w;
      b.h += h * w;
      b.s += s * w;
      b.l += l * w;
    }
    const ranked = buckets
      .filter((b) => b.w > 0.6)
      .map((b) => ({ h: b.h / b.w, s: b.s / b.w, l: b.l / b.w, w: b.w }))
      .sort((a, b) => b.w - a.w);

    let palette: Palette;
    if (!ranked.length) {
      // Monochrome art: keep it tasteful with a cool neutral gradient.
      const l = grayW ? grayL / grayW : 0.3;
      palette = {
        accent: hsl(220, 0.12, 0.78),
        colors: [hsl(220, 0.08, Math.max(0.18, l * 0.6)), hsl(230, 0.1, 0.34), hsl(210, 0.06, 0.12), hsl(240, 0.08, 0.5)],
        deep: hsl(230, 0.12, 0.06),
      };
    } else {
      const main = ranked[0];
      const others = ranked.slice(1, 4);
      while (others.length < 3) {
        const base = others[others.length - 1] ?? main;
        others.push({ ...base, h: (base.h + 40) % 360, l: base.l * 0.7, w: 0 });
      }
      palette = {
        accent: hsl(main.h, Math.max(0.55, main.s), Math.max(0.6, Math.min(0.72, main.l + 0.15))),
        colors: [main, ...others].map((c, i) =>
          hsl(c.h, Math.min(0.9, c.s * 1.05), Math.max(0.16, Math.min(0.58, c.l * (i === 3 ? 0.55 : 1)))),
        ),
        deep: hsl(main.h, Math.min(0.5, main.s * 0.6), 0.07),
      };
    }
    cache.set(src, palette);
    return palette;
  } catch {
    return DEFAULT_PALETTE;
  }
}
