import { Link } from 'react-router-dom';
import { ChevronUp, ListMusic, MicVocal, MoreHorizontal, Pause, PictureInPicture2, Play, SkipForward } from 'lucide-react';
import { desktop } from '../../lib/desktop';
import { usePlayer, useCurrentTrack } from '../../store/player';
import { useUI } from '../../store/ui';
import { Artwork, IconButton, cx } from '../ui/primitives';
import { ArtistLinks } from '../media/TrackRow';
import { LikeButton, SeekBar, TransportControls, VolumeControl } from './controls';

export function PlayerBar() {
  const track = useCurrentTrack();
  const openNowPlaying = useUI((s) => s.openNowPlaying);
  const openMenu = useUI((s) => s.openMenu);
  const nowPlayingOpen = useUI((s) => s.nowPlaying);
  const tab = useUI((s) => s.nowPlayingTab);
  const close = useUI((s) => s.closeNowPlaying);

  const toggleTab = (t: 'upnext' | 'lyrics') => {
    if (nowPlayingOpen && tab === t) close();
    else openNowPlaying(t);
  };

  return (
    <footer
      className={cx(
        'relative z-40 hidden h-[var(--player-h)] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-4 overflow-hidden px-4 md:grid',
        'glass rounded-none md:mx-2 md:mb-2 md:rounded-[26px] lg:mx-0 lg:mb-0',
      )}
    >
      {/* Ambient glow from the current artwork. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 transition-[background] duration-700"
        style={{
          background: track
            ? 'radial-gradient(60% 140% at 12% 100%, color-mix(in srgb, var(--tint-1) 30%, transparent), transparent 70%)'
            : undefined,
        }}
      />

      <div className="flex min-w-0 items-center gap-3">
        {track ? (
          <>
            <button
              type="button"
              onClick={() => openNowPlaying()}
              aria-label="Open now playing"
              className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg shadow-lg"
            >
              <Artwork src={track.thumbnail} className="h-full w-full" rounded="lg" eager />
              <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                <ChevronUp className="h-5 w-5" />
              </span>
            </button>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => openNowPlaying()}
                className="block max-w-full truncate text-left text-[15px] font-semibold hover:underline"
                title={track.title}
              >
                {track.title}
              </button>
              <p className="truncate text-sm text-ink-3">
                <ArtistLinks track={track} />
                {track.album?.id && (
                  <>
                    {' • '}
                    <Link to={`/album/${track.album.id}`} className="hover:text-ink hover:underline">
                      {track.album.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="ml-1 shrink-0">
              <LikeButton size={20} />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-3">Pick something to play</p>
        )}
      </div>

      <div className="flex min-w-0 flex-col items-center gap-0.5">
        <TransportControls />
        <SeekBar className="max-w-[640px]" />
      </div>

      <div className="flex items-center justify-end gap-1">
        <IconButton
          label="Lyrics (Y)"
          active={nowPlayingOpen && tab === 'lyrics'}
          disabled={!track}
          onClick={() => toggleTab('lyrics')}
          size="sm"
        >
          <MicVocal className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton
          label="Queue"
          active={nowPlayingOpen && tab === 'upnext'}
          disabled={!track}
          onClick={() => toggleTab('upnext')}
          size="sm"
        >
          <ListMusic className="h-[18px] w-[18px]" />
        </IconButton>
        {desktop && (
          <IconButton label="Mini player" disabled={!track} onClick={() => void desktop?.mini()} size="sm">
            <PictureInPicture2 className="h-[18px] w-[18px]" />
          </IconButton>
        )}
        <VolumeControl className="hidden lg:flex" />
        <IconButton
          label="More"
          disabled={!track}
          size="sm"
          onClick={(e) => {
            if (!track) return;
            const r = e.currentTarget.getBoundingClientRect();
            openMenu({ item: track, x: r.right, y: r.top });
          }}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
    </footer>
  );
}

/** Compact player that sits above the mobile tab bar. */
export function MiniPlayer() {
  const track = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const progress = usePlayer((s) => (s.duration ? s.currentTime / s.duration : 0));
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const openNowPlaying = useUI((s) => s.openNowPlaying);
  if (!track) return null;
  return (
    <div className="glass relative mx-2 mb-2 overflow-hidden rounded-2xl border border-white/10 shadow-2xl md:hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--tint-1) 45%, transparent), transparent)' }}
      />
      <div className="flex items-center gap-3 p-2">
        <button type="button" onClick={() => openNowPlaying()} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Artwork src={track.thumbnail} className="h-11 w-11 shrink-0" rounded="md" eager />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{track.title}</span>
            <span className="block truncate text-xs text-ink-2">{track.artists.map((a) => a.name).join(', ')}</span>
          </span>
        </button>
        <LikeButton size={20} />
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="grid h-10 w-10 place-items-center rounded-full text-ink active:scale-90"
        >
          {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
        </button>
        <button type="button" onClick={next} aria-label="Next" className="grid h-10 w-10 place-items-center rounded-full active:scale-90">
          <SkipForward className="h-5 w-5 fill-current" />
        </button>
      </div>
      <div className="absolute right-3 bottom-0 left-3 h-[2px] overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
