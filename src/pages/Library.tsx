import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Heart, Pencil, Plus, Trash2, ListMusic, Check, X } from 'lucide-react';
import { useLibrary } from '../store/library';
import { useUI, toast } from '../store/ui';
import { usePlayer } from '../store/player';
import type { Collection, Item } from '../lib/types';
import { relativeDay } from '../lib/format';
import { useApi } from '../lib/api';
import { useAccount } from '../store/account';
import { MediaCard } from '../components/media/MediaCard';
import { TrackRow } from '../components/media/TrackRow';
import { CollectionHeader, PlayButtons, TrackList, totalDuration } from '../components/media/Collection';
import { PlaylistCover } from '../components/overlays/Dialogs';
import { IconButton, Pill, cx } from '../components/ui/primitives';
import GooeyNav from '../components/rb/GooeyNav';
import CountUp from '../components/rb/CountUp';
import SpotlightCard from '../components/rb/SpotlightCard';
import ChromaGrid from '../components/rb/ChromaGrid';
import DotGrid from '../components/rb/DotGrid';
import BlurText from '../components/rb/BlurText';

const TABS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'songs', label: 'Liked songs' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'history', label: 'History' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const motionBg = useLibrary((s) => s.settings.motionBackgrounds);
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-20 text-center">
      {motionBg && (
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <DotGrid dotSize={3} gap={22} baseColor="#2a2833" activeColor="#ff4f7b" proximity={110} />
        </div>
      )}
      <div className="relative">
        <p className="font-display text-2xl font-bold">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-ink-3">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, decimals = 0, suffix }: { label: string; value: number; decimals?: number; suffix?: string }) {
  return (
    <SpotlightCard
      className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5"
      spotlightColor="color-mix(in srgb, var(--accent) 25%, transparent)"
      spotlightSize={260}
    >
      <p className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <CountUp to={value} decimals={decimals} duration={1.4} separator="," />
        {suffix && <span className="ml-1 text-lg text-ink-3">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm text-ink-3">{label}</p>
    </SpotlightCard>
  );
}

function PlaylistsTab() {
  const playlists = useLibrary((s) => s.playlists);
  const saved = useLibrary((s) => s.saved);
  const likes = useLibrary((s) => s.likes);
  const openCreate = useUI((s) => s.openCreatePlaylist);
  const navigate = useNavigate();
  const savedLists = saved.filter((c) => c.kind === 'playlist');
  const signedIn = useAccount((s) => !!s.status?.signedIn && !s.status.expired);
  const mine = useApi<{ items: Item[] }>(signedIn ? '/me/playlists' : null);
  return (
    <>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-8">
      <button type="button" onClick={() => openCreate()} className="group text-left">
        <div className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-white/15 text-ink-3 transition group-hover:border-white/40 group-hover:text-ink">
          <Plus className="h-10 w-10" />
        </div>
        <p className="mt-3 font-semibold">New playlist</p>
      </button>
      <button type="button" onClick={() => navigate('/library/liked')} className="group text-left">
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand to-brand-2 shadow-[0_10px_40px_-14px_#ff3d6e] transition-transform duration-300 group-hover:-translate-y-1">
          <Heart className="h-14 w-14 fill-white text-white drop-shadow-lg" />
        </div>
        <p className="mt-3 font-semibold">Liked songs</p>
        <p className="text-sm text-ink-3">{likes.length} songs</p>
      </button>
      {playlists.map((p) => (
        <Link key={p.id} to={`/library/playlist/${p.id}`} className="group">
          <PlaylistCover tracks={p.tracks} className="aspect-square w-full rounded-xl transition-transform duration-300 group-hover:-translate-y-1" />
          <p className="mt-3 truncate font-semibold">{p.name}</p>
          <p className="text-sm text-ink-3">{p.tracks.length} songs</p>
        </Link>
      ))}
      {savedLists.map((c) => (
        <MediaCard key={c.id} item={c} fluid />
      ))}
    </div>
    {signedIn && (
      <section className="mt-12">
        <h3 className="mb-5 font-display text-xl font-bold">From your YouTube Music</h3>
        {mine.data ? (
          mine.data.items.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-8">
              {mine.data.items.map((c) => (
                <MediaCard key={`${c.kind}:${c.id}`} item={c} fluid />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">No playlists in your YouTube Music library yet.</p>
          )
        ) : mine.error ? (
          <p className="text-sm text-ink-3">Couldn&apos;t load your playlists: {mine.error.message}</p>
        ) : (
          <div className="skeleton h-48 rounded-2xl" />
        )}
      </section>
    )}
    </>
  );
}

function ArtistsTab() {
  const saved = useLibrary((s) => s.saved);
  const artistStats = useLibrary((s) => s.artistStats);
  const trackStats = useLibrary((s) => s.trackStats);
  const navigate = useNavigate();
  const artists = useMemo(() => {
    const out: Collection[] = saved.filter((c) => c.kind === 'artist');
    const ids = new Set(out.map((a) => a.id));
    const tracks = Object.values(trackStats);
    for (const a of Object.values(artistStats).sort((x, y) => y.count - x.count)) {
      if (!a.item.id || ids.has(a.item.id)) continue;
      ids.add(a.item.id);
      const art = a.item.thumbnail ?? tracks.find((t) => t.item.artists.some((x) => x.id === a.item.id))?.item.thumbnail;
      out.push({ kind: 'artist', id: a.item.id, title: a.item.name, thumbnail: art, subtitle: `${a.count} plays` });
      if (out.length >= 40) break;
    }
    return out;
  }, [saved, artistStats, trackStats]);

  if (!artists.length) {
    return <Empty title="No artists yet" body="Artists you save or listen to often will show up here." />;
  }
  return (
    <ChromaGrid
      items={artists.map((a) => ({ image: a.thumbnail ?? '', title: a.title, subtitle: a.subtitle ?? 'Artist', url: `/artist/${a.id}` }))}
      minCardWidth={200}
      aspectRatio="1 / 1"
      onSelect={(item) => item.url && navigate(item.url)}
    />
  );
}

function HistoryTab() {
  const history = useLibrary((s) => s.history);
  const clear = useLibrary((s) => s.clearHistory);
  const groups = useMemo(() => {
    const map = new Map<string, typeof history>();
    for (const h of history) {
      const k = relativeDay(h.at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return [...map.entries()];
  }, [history]);
  if (!history.length) return <Empty title="Nothing played yet" body="Your listening history will appear here." />;
  const tracks = history.map((h) => h.track);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear your listening history? Recommendations will start fresh.')) clear();
          }}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
        >
          Clear history
        </button>
      </div>
      {groups.map(([day, entries]) => (
        <section key={day} className="mb-8">
          <h3 className="mb-2 px-2 font-display text-lg font-bold">{day}</h3>
          {entries.map((h) => {
            const i = history.indexOf(h);
            return (
              <TrackRow
                key={`${h.track.id}-${h.at}`}
                track={h.track}
                onPlay={() => usePlayer.getState().playQueue(tracks, i, { kind: 'history', title: 'History' })}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'playlists') as TabId;
  const likes = useLibrary((s) => s.likes);
  const playlists = useLibrary((s) => s.playlists.length);
  const saved = useLibrary((s) => s.saved);
  const listened = useLibrary((s) => s.listenedSeconds);
  const artistCount = useLibrary((s) => Object.keys(s.artistStats).length);
  const setTab = (t: TabId) => setParams(t === 'playlists' ? {} : { tab: t }, { replace: true });
  const albums = saved.filter((c) => c.kind === 'album');

  return (
    <div>
      <header className="mb-8 pt-2">
        <BlurText text="Your library" className="font-display text-4xl font-bold tracking-tight sm:text-6xl" animateBy="words" delay={80} />
      </header>
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Liked songs" value={likes.length} />
        <Stat label="Playlists" value={playlists + saved.filter((c) => c.kind === 'playlist').length} />
        <Stat label="Hours listened" value={Math.round((listened / 3600) * 10) / 10} decimals={1} />
        <Stat label="Artists discovered" value={artistCount} />
      </div>

      <div className="no-scrollbar -mx-4 mb-8 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
        <div className="hidden sm:block">
          <GooeyNav
            items={TABS.map((t) => ({ label: t.label }))}
            activeIndex={TABS.findIndex((t) => t.id === tab)}
            onChange={(i) => setTab(TABS[i].id)}
            size="sm"
            color="#ffffff"
            activeTextColor="#0b0b10"
          />
        </div>
        <div className="flex gap-2 sm:hidden">
          {TABS.map((t) => (
            <Pill key={t.id} active={t.id === tab} onClick={() => setTab(t.id)}>
              {t.label}
            </Pill>
          ))}
        </div>
      </div>

      {tab === 'playlists' && <PlaylistsTab />}
      {tab === 'songs' &&
        (likes.length ? (
          <>
            <div className="mb-6 flex gap-3">
              <PlayButtons tracks={likes} source={{ kind: 'liked', id: 'liked', title: 'Liked songs' }} />
            </div>
            <TrackList tracks={likes} source={{ kind: 'liked', id: 'liked', title: 'Liked songs' }} />
          </>
        ) : (
          <Empty title="Songs you like will appear here" body="Tap the heart on any song to save it. Press + while a song plays." />
        ))}
      {tab === 'albums' &&
        (albums.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-8">
            {albums.map((a) => (
              <MediaCard key={a.id} item={a as Item} fluid />
            ))}
          </div>
        ) : (
          <Empty title="No saved albums" body="Save albums from their page to find them here." />
        ))}
      {tab === 'artists' && <ArtistsTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liked songs & user playlists
// ---------------------------------------------------------------------------

export function LikedSongs() {
  const likes = useLibrary((s) => s.likes);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const source = { kind: 'liked' as const, id: 'liked', title: 'Liked songs' };
  return (
    <div>
      <CollectionHeader
        art={
          <div className="grid aspect-square w-full place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2">
            <Heart className="h-20 w-20 fill-white text-white drop-shadow-xl" />
          </div>
        }
        type="Auto playlist"
        title="Liked songs"
        meta={`${likes.length} songs • ${totalDuration(likes)}`}
        actions={<PlayButtons tracks={likes} source={source} />}
      />
      {likes.length ? (
        <TrackList
          tracks={likes}
          source={source}
          menuExtra={(i) => [{ label: 'Remove from liked songs', danger: true, icon: <X className="h-4 w-4" />, onSelect: () => toggleLike(likes[i]) }]}
        />
      ) : (
        <Empty title="No liked songs yet" body="Tap the heart on any song and it lands here." />
      )}
    </div>
  );
}

export function UserPlaylist() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id));
  const rename = useLibrary((s) => s.renamePlaylist);
  const remove = useLibrary((s) => s.deletePlaylist);
  const removeTrack = useLibrary((s) => s.removeFromPlaylist);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!playlist) {
    return <Empty title="Playlist not found" body="It may have been deleted." action={<Link to="/library" className="font-semibold text-accent">Back to library</Link>} />;
  }
  const source = { kind: 'local' as const, id: playlist.id, title: playlist.name, thumbnail: playlist.tracks[0]?.thumbnail };

  return (
    <div>
      <CollectionHeader
        art={<PlaylistCover tracks={playlist.tracks} className="aspect-square w-full rounded-2xl" />}
        artSrc={playlist.tracks[0]?.thumbnail}
        type="Your playlist"
        title={playlist.name}
        meta={`${playlist.tracks.length} songs • ${totalDuration(playlist.tracks)}`}
        actions={
          <>
            <PlayButtons tracks={playlist.tracks} source={source} />
            {editing ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename(playlist.id, name);
                  setEditing(false);
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-full border border-white/15 bg-black/30 px-4 outline-none focus:border-[var(--accent)]"
                  aria-label="Playlist name"
                />
                <IconButton label="Save name" type="submit" className={cx('bg-white text-black hover:bg-white hover:text-black')} size="lg">
                  <Check className="h-5 w-5" />
                </IconButton>
                <IconButton label="Cancel" onClick={() => setEditing(false)} className="bg-white/10" size="lg">
                  <X className="h-5 w-5" />
                </IconButton>
              </form>
            ) : (
              <IconButton
                label="Rename"
                onClick={() => {
                  setName(playlist.name);
                  setEditing(true);
                }}
                className="bg-white/10 backdrop-blur"
                size="lg"
              >
                <Pencil className="h-5 w-5" />
              </IconButton>
            )}
            <IconButton
              label="Delete playlist"
              onClick={() => {
                if (!window.confirm(`Delete “${playlist.name}”? This can't be undone.`)) return;
                remove(playlist.id);
                toast({ title: 'Playlist deleted', description: playlist.name });
                navigate('/library');
              }}
              className="bg-white/10 backdrop-blur hover:text-red-300"
              size="lg"
            >
              <Trash2 className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      {playlist.tracks.length ? (
        <TrackList
          tracks={playlist.tracks}
          source={source}
          menuExtra={(i) => [
            { label: 'Remove from this playlist', danger: true, icon: <Trash2 className="h-4 w-4" />, onSelect: () => removeTrack(playlist.id, i) },
          ]}
        />
      ) : (
        <Empty
          title="This playlist is empty"
          body="Right-click any song (or use its ⋯ menu) and choose “Add to playlist…”."
          action={
            <Link to="/search" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
              <ListMusic className="h-4 w-4" /> Find songs
            </Link>
          }
        />
      )}
    </div>
  );
}
