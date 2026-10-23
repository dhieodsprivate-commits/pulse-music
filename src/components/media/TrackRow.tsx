import { memo, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MoreHorizontal, Pause, Play } from 'lucide-react';
import type { Track } from '../../lib/types';
import { formatTime } from '../../lib/format';
import { usePlayer } from '../../store/player';
import { useLibrary } from '../../store/library';
import { useUI, type MenuState } from '../../store/ui';
import { Artwork, Equalizer, cx } from '../ui/primitives';

interface TrackRowProps {
  track: Track;
  index?: number;
  /** Show the track number instead of artwork (album pages). */
  numbered?: boolean;
  showAlbum?: boolean;
  onPlay: () => void;
  menuExtra?: MenuState['extra'];
  compact?: boolean;
}

export const ArtistLinks = memo(function ArtistLinks({ track, className }: { track: Track; className?: string }) {
  if (!track.artists.length) return <span className={className}>Unknown artist</span>;
  return (
    <span className={cx('truncate', className)}>
      {track.artists.map((a, i) => (
        <span key={`${a.name}-${i}`}>
          {i > 0 && ', '}
          {a.id ? (
            <Link
              to={`/artist/${a.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-ink hover:underline decoration-white/30 underline-offset-2"
            >
              {a.name}
            </Link>
          ) : (
            a.name
          )}
        </span>
      ))}
    </span>
  );
});

export const TrackRow = memo(function TrackRow({
  track,
  index,
  numbered,
  showAlbum = true,
  onPlay,
  menuExtra,
  compact,
}: TrackRowProps) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.track.id === track.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const liked = useLibrary((s) => s.likes.some((t) => t.id === track.id));
  const toggleLike = useLibrary((s) => s.toggleLike);
  const openMenu = useUI((s) => s.openMenu);

  const menu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu({
      item: track,
      x: e.type === 'contextmenu' ? e.clientX : r.right,
      y: e.type === 'contextmenu' ? e.clientY : r.bottom,
      extra: menuExtra,
    });
  };

  const handlePlay = () => {
    if (isCurrent) usePlayer.getState().toggle();
    else onPlay();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handlePlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handlePlay();
      }}
      onContextMenu={menu}
      className={cx(
        'group grid cursor-default items-center gap-3 rounded-xl px-2 outline-none transition-colors duration-150 select-none',
        compact ? 'py-1.5' : 'py-2',
        showAlbum ? 'grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]' : 'grid-cols-[auto_1fr_auto]',
        isCurrent ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05] focus-visible:bg-white/[0.06]',
      )}
    >
      {/* Leading: artwork or index, swapped for play/pause/equalizer on hover/current. */}
      <div className={cx('relative shrink-0', numbered ? 'w-8' : compact ? 'h-10 w-10' : 'h-12 w-12')}>
        {numbered ? (
          <span className={cx('block text-center text-sm tabular-nums text-ink-3 group-hover:opacity-0', isCurrent && 'opacity-0')}>
            {(index ?? 0) + 1}
          </span>
        ) : (
          <Artwork src={track.thumbnail} className="h-full w-full" rounded="md" />
        )}
        <span
          className={cx(
            'absolute inset-0 grid place-items-center rounded-md transition-opacity',
            numbered ? '' : 'bg-black/55',
            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {isCurrent && isPlaying ? (
            <>
              <Equalizer className="group-hover:hidden" />
              <Pause className="hidden h-4 w-4 fill-current group-hover:block" />
            </>
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </span>
      </div>

      <div className="min-w-0">
        <p className={cx('truncate text-[15px] font-medium', isCurrent && 'text-accent')}>{track.title}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink-3">
          {track.kind === 'video' && (
            <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] font-bold tracking-wide text-ink-2">VIDEO</span>
          )}
          <ArtistLinks track={track} />
          {!showAlbum && track.views && <span className="shrink-0">• {track.views}</span>}
        </p>
      </div>

      {showAlbum && (
        <p className="hidden min-w-0 truncate text-sm text-ink-3 md:block">
          {track.album?.id ? (
            <Link to={`/album/${track.album.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-ink hover:underline">
              {track.album.name}
            </Link>
          ) : (
            track.album?.name ?? track.views ?? ''
          )}
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={liked ? 'Remove from liked songs' : 'Add to liked songs'}
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(track);
          }}
          className={cx(
            'grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 active:scale-90',
            liked ? 'text-accent' : 'text-ink-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Heart className={cx('h-4 w-4', liked && 'fill-current')} />
        </button>
        <span className="w-11 text-right text-sm tabular-nums text-ink-3">{track.duration ? formatTime(track.duration) : ''}</span>
        <button
          type="button"
          aria-label="More actions"
          onClick={menu}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-3 opacity-0 transition hover:bg-white/10 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
