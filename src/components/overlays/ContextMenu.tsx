import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  ExternalLink,
  Heart,
  Link2,
  ListEnd,
  ListPlus,
  ListStart,
  Pin,
  PinOff,
  Play,
  Radio,
  Shuffle,
  Library,
  UserRound,
} from 'lucide-react';
import { useUI, type MenuState } from '../../store/ui';
import { useLibrary } from '../../store/library';
import { isTrack, type Collection, type Item } from '../../lib/types';
import { copyLink, itemUrl, playItem, queueItem, radioFor, resolveTracks } from '../../lib/actions';
import { toast } from '../../store/ui';
import { cx } from '../ui/primitives';

interface Entry {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  divider?: boolean;
}

function useEntries(item: Item): Entry[] {
  const navigate = useNavigate();
  const lib = useLibrary();
  const ui = useUI.getState();
  const close = () => ui.closeMenu();
  const ic = 'h-4 w-4';
  const entries: Entry[] = [];

  if (isTrack(item)) {
    const liked = lib.isLiked(item.id);
    entries.push(
      { label: 'Play next', icon: <ListStart className={ic} />, onSelect: () => void queueItem(item, 'next') },
      { label: 'Add to queue', icon: <ListEnd className={ic} />, onSelect: () => void queueItem(item, 'end') },
      { label: 'Start radio', icon: <Radio className={ic} />, onSelect: () => void radioFor(item) },
      {
        label: liked ? 'Remove from liked songs' : 'Add to liked songs',
        icon: <Heart className={cx(ic, liked && 'fill-current text-accent')} />,
        onSelect: () => {
          const now = lib.toggleLike(item);
          toast({ title: now ? 'Added to liked songs' : 'Removed from liked songs', description: item.title });
        },
        divider: true,
      },
      { label: 'Add to playlist…', icon: <ListPlus className={ic} />, onSelect: () => ui.openAddToPlaylist([item]) },
    );
    if (item.album?.id) {
      const id = item.album.id;
      entries.push({ label: 'Go to album', icon: <Disc3 className={ic} />, onSelect: () => (ui.closeNowPlaying(), navigate(`/album/${id}`)), divider: true });
    }
    const artist = item.artists.find((a) => a.id);
    if (artist?.id) {
      entries.push({
        label: `Go to ${artist.name}`,
        icon: <UserRound className={ic} />,
        onSelect: () => (ui.closeNowPlaying(), navigate(`/artist/${artist.id}`)),
        divider: !item.album?.id,
      });
    }
  } else {
    const c = item as Collection;
    entries.push(
      { label: 'Play', icon: <Play className={ic} />, onSelect: () => void playItem(c) },
      { label: 'Shuffle play', icon: <Shuffle className={ic} />, onSelect: () => void playItem(c, { shuffle: true }) },
    );
    if (c.kind !== 'artist') {
      entries.push(
        { label: 'Play next', icon: <ListStart className={ic} />, onSelect: () => void queueItem(c, 'next') },
        { label: 'Add to queue', icon: <ListEnd className={ic} />, onSelect: () => void queueItem(c, 'end') },
      );
    }
    entries.push({ label: c.kind === 'artist' ? 'Start artist radio' : 'Start radio', icon: <Radio className={ic} />, onSelect: () => void radioFor(c) });
    const saved = lib.isSaved(c);
    entries.push({
      label: saved ? 'Remove from library' : 'Save to library',
      icon: <Library className={cx(ic, saved && 'text-accent')} />,
      onSelect: () => {
        const now = lib.toggleSaved(c);
        toast({ title: now ? 'Saved to library' : 'Removed from library', description: c.title });
      },
      divider: true,
    });
    if (c.kind !== 'artist') {
      entries.push({
        label: 'Add to playlist…',
        icon: <ListPlus className={ic} />,
        onSelect: () =>
          void resolveTracks(c)
            .then(({ tracks }) => ui.openAddToPlaylist(tracks))
            .catch(() => toast({ title: 'Could not load tracks' })),
      });
    }
  }

  const pinned = lib.isPinned(item);
  entries.push({
    label: pinned ? 'Unpin from Speed dial' : 'Pin to Speed dial',
    icon: pinned ? <PinOff className={ic} /> : <Pin className={ic} />,
    onSelect: () => {
      const now = lib.togglePin(item);
      toast({ title: now ? 'Pinned to Speed dial' : 'Unpinned from Speed dial', description: item.title });
    },
    divider: true,
  });
  entries.push(
    { label: 'Copy link', icon: <Link2 className={ic} />, onSelect: () => void copyLink(item) },
    {
      label: 'Open in YouTube Music',
      icon: <ExternalLink className={ic} />,
      onSelect: () => {
        window.open(itemUrl(item), '_blank', 'noopener,noreferrer');
      },
    },
  );
  return entries.map((e) => ({ ...e, onSelect: () => (close(), e.onSelect()) }));
}

/** Receives the menu as a prop so it stays valid while the exit animation plays. */
function Menu({ menu }: { menu: MenuState }) {
  const closeMenu = useUI((s) => s.closeMenu);
  const entries = useEntries(menu.item);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y, origin: 'top left' });

  const extra: Entry[] = (menu.extra ?? []).map((x, i) => ({
    label: x.label,
    icon: x.icon ?? <span className="h-4 w-4" />,
    danger: x.danger,
    divider: i === 0,
    onSelect: () => {
      closeMenu();
      x.onSelect();
    },
  }));
  const all = [...entries, ...extra];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    const flipX = menu.x + width + pad > window.innerWidth;
    const flipY = menu.y + height + pad > window.innerHeight;
    setPos({
      left: Math.max(pad, flipX ? menu.x - width : menu.x),
      top: Math.max(pad, flipY ? Math.min(menu.y - height, window.innerHeight - height - pad) : menu.y),
      origin: `${flipY ? 'bottom' : 'top'} ${flipX ? 'right' : 'left'}`,
    });
  }, [menu.x, menu.y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeMenu();
    };
    const onScroll = () => closeMenu();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', onScroll, { passive: true });
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', onScroll);
    };
  }, [closeMenu]);

  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    }
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', damping: 26, stiffness: 420 }}
      style={{ left: pos.left, top: pos.top, transformOrigin: pos.origin }}
      className="glass-strong fixed z-[90] max-h-[min(560px,calc(100vh-16px))] w-64 overflow-y-auto rounded-2xl p-1.5"
    >
      <div className="truncate px-3 pt-2 pb-1.5 text-xs font-semibold text-ink-3">{menu.item.title}</div>
      {all.map((e) => (
        <div key={e.label}>
          {e.divider && <div className="mx-2 my-1 h-px bg-white/[0.08]" />}
          <button
            type="button"
            role="menuitem"
            onClick={e.onSelect}
            className={cx(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors',
              e.danger ? 'text-red-300 hover:bg-red-500/15 focus:bg-red-500/15' : 'text-ink hover:bg-white/[0.08] focus:bg-white/[0.08]',
            )}
          >
            <span className="text-ink-2">{e.icon}</span>
            {e.label}
          </button>
        </div>
      ))}
    </motion.div>
  );
}

export function ContextMenu() {
  const menu = useUI((s) => s.menu);
  return createPortal(
    <AnimatePresence>{menu && <Menu key={`${menu.item.kind}:${menu.item.id}:${menu.x}:${menu.y}`} menu={menu} />}</AnimatePresence>,
    document.body,
  );
}
