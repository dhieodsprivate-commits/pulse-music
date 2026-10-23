import { memo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Pause, Play } from 'lucide-react';
import type { Item } from '../../lib/types';
import { isTrack } from '../../lib/types';
import { itemHref, itemSubtitle } from '../../lib/format';
import { playItem } from '../../lib/actions';
import { usePlayer } from '../../store/player';
import { useUI } from '../../store/ui';
import { Artwork, cx } from '../ui/primitives';

interface MediaCardProps {
  item: Item;
  /** Override what clicking play does (e.g. play within a list). */
  onPlay?: () => void;
  size?: 'md' | 'lg';
  /** Fill the parent (grid layouts) instead of a fixed shelf width. */
  fluid?: boolean;
  className?: string;
}

export const MediaCard = memo(function MediaCard({ item, onPlay, size = 'md', fluid, className }: MediaCardProps) {
  const navigate = useNavigate();
  const openMenu = useUI((s) => s.openMenu);
  const isCurrent = usePlayer((s) => {
    const cur = s.queue[s.index]?.track;
    if (!cur) return false;
    if (isTrack(item)) return cur.id === item.id;
    return s.source?.id === item.id;
  });
  const isPlaying = usePlayer((s) => s.isPlaying);
  const href = itemHref(item);
  const round = item.kind === 'artist';
  const wide = item.kind === 'video';

  const play = (e: MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) return usePlayer.getState().toggle();
    if (onPlay) onPlay();
    else void playItem(item);
  };

  const open = () => {
    if (href) navigate(href);
    else if (onPlay) onPlay();
    else void playItem(item);
  };

  const menu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({ item, x: e.clientX, y: e.clientY });
  };

  const width = fluid ? 'w-full' : wide ? (size === 'lg' ? 'w-80' : 'w-64 sm:w-72') : size === 'lg' ? 'w-52 sm:w-56' : 'w-40 sm:w-44';

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      onContextMenu={menu}
      className={cx('group shrink-0 cursor-pointer outline-none select-none', width, className)}
    >
      <div
        className={cx(
          'relative overflow-hidden shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-14px_color-mix(in_srgb,var(--accent)_45%,black)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--accent)]',
          round ? 'aspect-square rounded-full' : wide ? 'aspect-video rounded-xl' : 'aspect-square rounded-xl',
        )}
      >
        <Artwork
          src={item.thumbnail}
          alt={item.title}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.06]"
          rounded={round ? 'full' : 'xl'}
        />
        <div
          className={cx(
            'absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-300',
            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />
        {!round && (
          <button
            type="button"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              openMenu({ item, x: r.right, y: r.bottom });
            }}
            className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={isCurrent && isPlaying ? 'Pause' : `Play ${item.title}`}
          onClick={play}
          className={cx(
            'absolute grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-xl transition-all duration-300 hover:scale-110 active:scale-95',
            round ? 'right-1/2 bottom-1/2 translate-x-1/2 translate-y-1/2' : 'right-3 bottom-3',
            isCurrent ? 'scale-100 opacity-100' : 'translate-y-2 scale-90 opacity-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 focus-visible:opacity-100',
            round && !isCurrent && 'group-hover:translate-y-1/2',
          )}
        >
          {isCurrent && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </button>
      </div>
      <div className={cx('mt-3 min-w-0', round && 'text-center')}>
        <p className={cx('truncate text-[15px] font-semibold', isCurrent && 'text-accent')} title={item.title}>
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{itemSubtitle(item)}</p>
      </div>
    </div>
  );
});
