import { useState, type ReactNode } from 'react';
import { Clock3, Pause, Play, Shuffle } from 'lucide-react';
import type { QueueSource, Track } from '../../lib/types';
import { formatTotal } from '../../lib/format';
import { usePlayer } from '../../store/player';
import { Artwork, Skeleton, cx } from '../ui/primitives';
import { TrackRow } from './TrackRow';
import BlurText from '../rb/BlurText';
import { useScenePalette } from '../../hooks/useScene';
import type { MenuState } from '../../store/ui';

interface HeaderProps {
  art: ReactNode;
  artSrc?: string;
  type: string;
  title: string;
  meta: ReactNode;
  description?: string;
  actions?: ReactNode;
}

export function CollectionHeader({ art, artSrc, type, title, meta, description, actions }: HeaderProps) {
  const palette = useScenePalette(artSrc ?? title, artSrc);
  const [expanded, setExpanded] = useState(false);
  return (
    <header className="relative isolate -mx-4 -mt-16 mb-6 px-4 pt-24 pb-8 sm:-mx-8 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700"
        style={{
          background: `linear-gradient(180deg, ${palette.colors[0]} 0%, color-mix(in srgb, ${palette.colors[0]} 35%, transparent) 55%, transparent 100%)`,
          opacity: 0.55,
        }}
      />
      <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:text-left">
        <div className="w-52 shrink-0 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)] sm:w-60">{art}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">{type}</p>
          <BlurText
            key={title}
            text={title}
            animateBy="words"
            direction="bottom"
            delay={60}
            className="mt-2 font-display text-3xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl md:justify-start justify-center"
          />
          <div className="mt-3 text-sm text-white/75">{meta}</div>
          {description && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={cx('mt-3 max-w-2xl text-left text-sm leading-relaxed text-white/60 whitespace-pre-line', !expanded && 'line-clamp-2')}
            >
              {description}
            </button>
          )}
          {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function PlayButtons({ tracks, source }: { tracks: Track[]; source: QueueSource }) {
  const isThis = usePlayer((s) => s.source?.kind === source.kind && s.source?.id === source.id && s.index >= 0);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const player = usePlayer.getState;
  const disabled = !tracks.length;
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isThis ? player().toggle() : player().playQueue(tracks, 0, source, { shuffle: false }))}
        className="flex h-12 items-center gap-2 rounded-full bg-white pr-6 pl-5 font-semibold text-black shadow-[0_10px_40px_-10px_var(--accent)] transition hover:scale-105 active:scale-95 disabled:opacity-40"
      >
        {isThis && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        {isThis && isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => player().playQueue(tracks, 0, source, { shuffle: true })}
        className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold backdrop-blur transition hover:bg-white/20 active:scale-95 disabled:opacity-40"
      >
        <Shuffle className="h-5 w-5" /> Shuffle
      </button>
    </>
  );
}

export function TrackList({
  tracks,
  source,
  numbered,
  showAlbum = true,
  menuExtra,
}: {
  tracks: Track[];
  source: QueueSource;
  numbered?: boolean;
  showAlbum?: boolean;
  menuExtra?: (index: number) => MenuState['extra'];
}) {
  const play = (i: number) => usePlayer.getState().playQueue(tracks, i, source, { shuffle: false });
  return (
    <div>
      <div
        className={cx(
          'mb-1 grid items-center gap-3 border-b border-white/[0.06] px-2 pb-2 text-xs font-semibold tracking-[0.12em] text-ink-3 uppercase',
          showAlbum ? 'grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]' : 'grid-cols-[auto_1fr_auto]',
        )}
      >
        <span className={numbered ? 'w-8 text-center' : 'w-12'}>#</span>
        <span>Title</span>
        {showAlbum && <span className="hidden md:block">Album</span>}
        <span className="flex w-[124px] justify-end pr-10">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
      </div>
      {tracks.map((t, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          track={t}
          index={i}
          numbered={numbered}
          showAlbum={showAlbum}
          onPlay={() => play(i)}
          menuExtra={menuExtra?.(i)}
        />
      ))}
    </div>
  );
}

export const totalDuration = (tracks: Track[]) => formatTotal(tracks.reduce((a, t) => a + (t.duration ?? 0), 0));

export function CollectionSkeleton() {
  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-6 pt-8 md:flex-row md:items-end">
        <Skeleton className="h-60 w-60 rounded-2xl" />
        <div className="w-full flex-1 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-3 pt-3">
            <Skeleton className="h-12 w-28 rounded-full" />
            <Skeleton className="h-12 w-28 rounded-full" />
          </div>
        </div>
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoverArt({ src, alt }: { src?: string; alt: string }) {
  return <Artwork src={src} alt={alt} className="aspect-square w-full" rounded="xl" eager />;
}
