import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Check, Heart, Plus, X } from 'lucide-react';
import { useUI, toast } from '../../store/ui';
import { useLibrary } from '../../store/library';
import { Artwork, cx } from '../ui/primitives';
import SwipeToast from '../rb/SwipeToast';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="glass-strong w-full max-w-md overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function CreatePlaylistDialog() {
  const state = useUI((s) => s.createPlaylist);
  const close = useUI((s) => s.closeCreatePlaylist);
  const create = useLibrary((s) => s.createPlaylist);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [state]);

  const submit = () => {
    if (!state) return;
    const p = create(name, state.tracks);
    close();
    toast({
      title: `Created “${p.name}”`,
      description: state.tracks.length ? `${state.tracks.length} track${state.tracks.length === 1 ? '' : 's'} added` : undefined,
      actionLabel: 'Open',
      onAction: () => navigate(`/library/playlist/${p.id}`),
    });
  };

  return (
    <Modal open={!!state} onClose={close} title="New playlist">
      <form
        className="px-6 pt-2 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="mb-2 block text-sm text-ink-3" htmlFor="pl-name">
          Name
        </label>
        <input
          id="pl-name"
          ref={inputRef}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="My awesome playlist"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-base outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-white/10">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-105 active:scale-95"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AddToPlaylistDialog() {
  const tracks = useUI((s) => s.addToPlaylist);
  const close = useUI((s) => s.closeAddToPlaylist);
  const openCreate = useUI((s) => s.openCreatePlaylist);
  const playlists = useLibrary((s) => s.playlists);
  const addToPlaylist = useLibrary((s) => s.addToPlaylist);
  const likes = useLibrary((s) => s.likes);
  const toggleLike = useLibrary((s) => s.toggleLike);

  const add = (id: string, name: string) => {
    if (!tracks) return;
    const n = addToPlaylist(id, tracks);
    close();
    toast({
      title: n ? `Added to “${name}”` : `Already in “${name}”`,
      description: n ? `${n} track${n === 1 ? '' : 's'}` : undefined,
    });
  };

  const likeAll = () => {
    if (!tracks) return;
    const have = new Set(likes.map((t) => t.id));
    const fresh = tracks.filter((t) => !have.has(t.id));
    fresh.forEach((t) => toggleLike(t));
    close();
    toast({ title: fresh.length ? 'Added to liked songs' : 'Already in liked songs' });
  };

  return (
    <Modal open={!!tracks} onClose={close} title="Add to playlist">
      <div className="max-h-[60vh] overflow-y-auto px-3 pb-4">
        <button
          type="button"
          onClick={() => openCreate(tracks ?? [])}
          className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/[0.06]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-black">
            <Plus className="h-6 w-6" />
          </span>
          <span className="font-semibold">New playlist</span>
        </button>
        <button type="button" onClick={likeAll} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/[0.06]">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2">
            <Heart className="h-5 w-5 fill-white" />
          </span>
          <span>
            <span className="block font-semibold">Liked songs</span>
            <span className="block text-sm text-ink-3">{likes.length} songs</span>
          </span>
        </button>
        {playlists.map((p) => {
          const has = tracks?.length === 1 && p.tracks.some((t) => t.id === tracks[0].id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p.id, p.name)}
              className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/[0.06]"
            >
              <PlaylistCover tracks={p.tracks} className="h-12 w-12" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-sm text-ink-3">{p.tracks.length} songs</span>
              </span>
              {has && <Check className="h-5 w-5 text-accent" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** 2×2 collage of the first artworks, or a gradient for empty playlists. */
export function PlaylistCover({ tracks, className }: { tracks: { thumbnail?: string }[]; className?: string }) {
  const arts = [...new Set(tracks.map((t) => t.thumbnail).filter(Boolean))].slice(0, 4) as string[];
  if (arts.length < 4) {
    return arts[0] ? (
      <Artwork src={arts[0]} className={cx('shrink-0', className)} rounded="lg" />
    ) : (
      <div className={cx('grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-surface-3 to-[#2b2140] text-ink-3', className)}>
        <span className="font-display text-lg">♪</span>
      </div>
    );
  }
  return (
    <div className={cx('grid shrink-0 grid-cols-2 overflow-hidden rounded-lg', className)}>
      {arts.map((a) => (
        <Artwork key={a} src={a} className="aspect-square h-full w-full" rounded="md" />
      ))}
    </div>
  );
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-[calc(var(--player-h)+16px)] z-[100] flex w-[min(360px,calc(100vw-32px))] flex-col items-end max-md:bottom-[150px]">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full">
          <SwipeToast
            inline
            title={t.title}
            description={t.description}
            icon={t.icon}
            actionLabel={t.actionLabel}
            onAction={t.onAction}
            duration={t.duration ?? 3500}
            width={360}
            radius={18}
            background="rgba(34,33,46,0.9)"
            color="#f4f3f8"
            fuseColor="var(--accent)"
            onClose={() => dismiss(t.id)}
          />
        </div>
      ))}
    </div>,
    document.body,
  );
}

const SHORTCUTS: [string, string][] = [
  ['Space / K', 'Play / pause'],
  ['N / P', 'Next / previous track'],
  ['→ / L', 'Forward 10s (Shift: 5s)'],
  ['← / J', 'Back 10s (Shift: 5s)'],
  ['M', 'Mute'],
  ['S', 'Shuffle'],
  ['R', 'Repeat mode'],
  ['+', 'Like current song'],
  ['F', 'Toggle now playing'],
  ['Y', 'Show lyrics'],
  ['↑ / ↓', 'Volume (in now playing)'],
  ['/', 'Search'],
  ['?', 'This help'],
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcuts);
  const set = useUI((s) => s.setShortcuts);
  return (
    <Modal open={open} onClose={() => set(false)} title="Keyboard shortcuts">
      <div className="grid gap-1 px-6 pt-2 pb-6">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-xl px-1 py-1.5 text-sm">
            <span className="text-ink-2">{v}</span>
            <kbd className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-xs">{k}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
