import { useEffect } from 'react';
import { engine } from '../../lib/engine';
import { bindEngine } from '../../store/player';
import { useUI, toast } from '../../store/ui';

/**
 * Wires the one-and-only YouTube player into the app. The iframe lives in
 * `engine.host` (outside React) and is floated over whichever element
 * registers itself as the video slot (Now Playing in video mode); otherwise
 * it's parked offscreen.
 */
export function PlayerHost() {
  const slot = useUI((s) => s.videoSlot);

  useEffect(() => {
    const unbind = bindEngine();
    engine.attach().catch((err: Error) => toast({ title: 'Player unavailable', description: err.message }));
    return unbind;
  }, []);

  useEffect(() => {
    const host = engine.host;
    if (!slot) {
      Object.assign(host.style, {
        transform: 'translate3d(-200vw, 0, 0)',
        width: '480px',
        height: '270px',
        opacity: '0',
        borderRadius: '0px',
      });
      return;
    }
    let raf = 0;
    let last = '';
    const follow = () => {
      const r = slot.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
      if (key !== last) {
        last = key;
        Object.assign(host.style, {
          transform: `translate3d(${r.left}px, ${r.top}px, 0)`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          opacity: r.width > 2 ? '1' : '0',
          borderRadius: getComputedStyle(slot).borderRadius,
        });
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [slot]);

  return null;
}
