import { useEffect, useRef, useState } from 'react';
import { Heart, Maximize2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { openChannel, type MiniCommand, type MiniState } from '../lib/sync';
import { desktop } from '../lib/desktop';
import { artistNames, formatTime } from '../lib/format';
import { Artwork, cx } from '../components/ui/primitives';

/** Always-on-top glass mini player (desktop app only). */
export default function MiniWindow() {
  const [state, setState] = useState<MiniState | null>(null);
  const [time, setTime] = useState(0);
  const send = useRef<(c: MiniCommand) => void>(() => {});
  const anchor = useRef({ t: 0, at: 0, playing: false });

  useEffect(() => {
    document.documentElement.classList.add('desktop');
    const ch = openChannel((m) => {
      if (m.type !== 'state') return;
      setState(m.state);
      anchor.current = { t: m.state.currentTime, at: performance.now(), playing: m.state.isPlaying };
    });
    send.current = (command) => ch.post({ type: 'command', command });
    send.current({ cmd: 'hello' });
    return () => ch.close();
  }, []);

  // Smooth progress between the main window's ~4 Hz updates.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const a = anchor.current;
      setTime(a.playing ? a.t + (performance.now() - a.at) / 1000 : a.t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const track = state?.track ?? null;
  const duration = state?.duration || track?.duration || 0;
  const progress = duration ? Math.min(1, time / duration) : 0;
  const cmd = (c: MiniCommand) => send.current(c);

  return (
    <div
      className="app-drag relative flex h-screen w-screen items-center gap-3 overflow-hidden rounded-[18px] p-3 text-ink select-none"
      style={{
        background: state
          ? `linear-gradient(120deg, color-mix(in srgb, ${state.colors[0]} 38%, rgb(10 10 16 / 0.45)), rgb(10 10 16 / 0.35))`
          : 'rgb(10 10 16 / 0.5)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[18px] shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
      <button type="button" onClick={() => cmd({ cmd: 'open-main' })} className="relative shrink-0" title="Open Pulse">
        <Artwork src={track?.thumbnail} className="h-[100px] w-[100px] shadow-xl" rounded="xl" eager />
      </button>

      <div className="relative flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{track?.title ?? 'Nothing playing'}</p>
            <p className="truncate text-xs text-white/65">{track ? artistNames(track) : 'Play something in Pulse'}</p>
          </div>
          <button
            type="button"
            aria-label="Open Pulse"
            onClick={() => cmd({ cmd: 'open-main' })}
            className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close mini player"
            onClick={() => void desktop?.mini(false)}
            className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={state?.liked ? 'Unlike' : 'Like'}
            disabled={!track}
            onClick={() => cmd({ cmd: 'like' })}
            className={cx('grid h-8 w-8 place-items-center rounded-full hover:bg-white/10', state?.liked ? 'text-[var(--mini-accent)]' : 'text-white/70')}
            style={{ ['--mini-accent' as string]: state?.accent ?? '#ff4f7b' }}
          >
            <Heart className={cx('h-4 w-4', state?.liked && 'fill-current')} />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous" disabled={!track} onClick={() => cmd({ cmd: 'prev' })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 active:scale-90">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button
              type="button"
              aria-label={state?.isPlaying ? 'Pause' : 'Play'}
              disabled={!track}
              onClick={() => cmd({ cmd: 'toggle' })}
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              {state?.isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <button type="button" aria-label="Next" disabled={!track} onClick={() => cmd({ cmd: 'next' })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 active:scale-90">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>
          <span className="w-8 text-right text-[10px] text-white/55 tabular-nums">{formatTime(time)}</span>
        </div>

        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          className="group relative h-3 cursor-pointer"
          onPointerDown={(e) => {
            if (!duration) return;
            const r = e.currentTarget.getBoundingClientRect();
            cmd({ cmd: 'seek', value: ((e.clientX - r.left) / r.width) * duration });
          }}
        >
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/15 transition-[height] group-hover:h-1.5">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: state?.accent ?? '#fff' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
