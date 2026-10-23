import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pause, Play, X } from 'lucide-react';
import { useApi, q } from '../lib/api';
import type { HomeData, Item, SearchData, Track } from '../lib/types';
import { isTrack } from '../lib/types';
import { itemHref, itemSubtitle } from '../lib/format';
import { playItem } from '../lib/actions';
import { usePlayer } from '../store/player';
import { useLibrary } from '../store/library';
import { useUI } from '../store/ui';
import { MobileSearch } from '../components/layout/TopBar';
import { MediaCard } from '../components/media/MediaCard';
import { Shelf } from '../components/media/Shelf';
import { TrackRow } from '../components/media/TrackRow';
import { Artwork, ErrorState, Pill, SectionHeader, Skeleton, cx } from '../components/ui/primitives';
import GooeyNav from '../components/rb/GooeyNav';
import BorderGlow from '../components/rb/BorderGlow';
import Orb from '../components/rb/Orb';
import TextType from '../components/rb/TextType';
import { MOOD_STYLES } from '../lib/moods';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'song', label: 'Songs' },
  { id: 'video', label: 'Videos' },
  { id: 'album', label: 'Albums' },
  { id: 'artist', label: 'Artists' },
  { id: 'playlist', label: 'Playlists' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

function TopResult({ item }: { item: Item }) {
  const navigate = useNavigate();
  const palette = useUI((s) => s.palette);
  const isCurrent = usePlayer((s) => {
    const cur = s.queue[s.index]?.track;
    return !!cur && (isTrack(item) ? cur.id === item.id : s.source?.id === item.id);
  });
  const isPlaying = usePlayer((s) => s.isPlaying);
  const href = itemHref(item);
  const round = item.kind === 'artist';
  return (
    <BorderGlow
      className="h-full"
      glowColor="340 90 70"
      backgroundColor="#121019"
      borderRadius={24}
      glowRadius={36}
      colors={palette.colors.slice(0, 3)}
      fillOpacity={0.35}
    >
      <div
        role="link"
        tabIndex={0}
        onClick={() => (href ? navigate(href) : void playItem(item))}
        onKeyDown={(e) => e.key === 'Enter' && (href ? navigate(href) : void playItem(item))}
        className="group relative flex h-full cursor-pointer flex-col gap-5 p-6 outline-none"
      >
        <Artwork
          src={item.thumbnail}
          className={cx('shadow-2xl', round ? 'h-32 w-32' : item.kind === 'video' ? 'aspect-video w-56' : 'h-32 w-32')}
          rounded={round ? 'full' : 'lg'}
          eager
        />
        <div className="min-w-0">
          <p className="line-clamp-2 font-display text-3xl font-bold tracking-tight">{item.title}</p>
          <p className="mt-1 truncate text-sm text-ink-2">
            <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-ink capitalize">{item.kind}</span>
            {isTrack(item) ? item.artists.map((a) => a.name).join(', ') : itemSubtitle(item)}
          </p>
        </div>
        <button
          type="button"
          aria-label={isCurrent && isPlaying ? 'Pause' : `Play ${item.title}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isCurrent) usePlayer.getState().toggle();
            else void playItem(item);
          }}
          className={cx(
            'absolute right-6 bottom-6 grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-[0_10px_40px_-6px_var(--accent)] transition-all duration-300 hover:scale-110',
            isCurrent ? 'opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          {isCurrent && isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
        </button>
      </div>
    </BorderGlow>
  );
}

function SearchLanding() {
  const navigate = useNavigate();
  const searches = useLibrary((s) => s.searches);
  const removeSearch = useLibrary((s) => s.removeSearch);
  const clearSearches = useLibrary((s) => s.clearSearches);
  const motionBg = useLibrary((s) => s.settings.motionBackgrounds);
  const palette = useUI((s) => s.palette);
  const home = useApi<HomeData>('/home');
  return (
    <div>
      <MobileSearch />
      <section className="relative mb-12 flex flex-col items-center overflow-hidden rounded-[32px] border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-90">
          {motionBg && <Orb colors={palette.colors.slice(0, 3)} backgroundColor="#0b0a10" hoverIntensity={0.4} />}
        </div>
        <div className="relative">
          <p className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Find your next favorite</p>
          <p className="mt-3 h-7 text-lg text-ink-2">
            <TextType
              text={['a song stuck in your head', 'an artist you love', 'the album everyone talks about', 'a playlist for tonight']}
              typingSpeed={55}
              deletingSpeed={30}
              pauseDuration={1800}
              cursorCharacter="▍"
              cursorClassName="text-accent"
              prefix="Search for "
            />
          </p>
          <button
            type="button"
            onClick={() => useUI.getState().focusSearch()}
            className="mt-7 hidden rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-105 active:scale-95 sm:inline-block"
          >
            Start searching <kbd className="ml-2 rounded border border-black/20 px-1.5 text-xs">/</kbd>
          </button>
        </div>
      </section>

      {searches.length > 0 && (
        <section className="mb-12">
          <SectionHeader
            title="Recent searches"
            action={
              <button type="button" onClick={clearSearches} className="text-sm font-semibold text-ink-3 hover:text-ink">
                Clear all
              </button>
            }
          />
          <div className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <span key={s} className="group flex items-center rounded-full bg-white/[0.07] pr-1 transition hover:bg-white/[0.12]">
                <button type="button" onClick={() => navigate(`/search${q({ q: s })}`)} className="py-1.5 pl-4 text-sm font-medium">
                  {s}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => removeSearch(s)}
                  className="ml-1 grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      {home.data?.moods.length ? (
        <section className="mb-12">
          <SectionHeader title="Moods & moments" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {home.data.moods.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => navigate(`/mood/${encodeURIComponent(m)}`)}
                className="relative h-24 overflow-hidden rounded-2xl p-4 text-left font-display text-lg font-bold transition hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: MOOD_STYLES[i % MOOD_STYLES.length] }}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const filter = (FILTERS.find((f) => f.id === params.get('f'))?.id ?? 'all') as FilterId;
  const { data, error, loading, reload } = useApi<SearchData>(query ? `/search${q({ q: query, type: filter })}` : null);

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    return {
      songs: items.filter((i): i is Track => i.kind === 'song'),
      videos: items.filter((i): i is Track => i.kind === 'video'),
      albums: items.filter((i) => i.kind === 'album'),
      artists: items.filter((i) => i.kind === 'artist'),
      playlists: items.filter((i) => i.kind === 'playlist'),
    };
  }, [data]);

  if (!query) return <SearchLanding />;

  const setFilter = (f: FilterId) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('f');
    else next.set('f', f);
    setParams(next, { replace: true });
  };
  const source = { kind: 'search' as const, title: `Search: ${query}` };
  const playTracks = (tracks: Track[], i: number) => usePlayer.getState().playQueue(tracks, i, source);

  return (
    <div>
      <MobileSearch />
      <div className="no-scrollbar -mx-4 mb-8 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
        <div className="hidden sm:block">
          <GooeyNav
            items={FILTERS.map((f) => ({ label: f.label }))}
            activeIndex={FILTERS.findIndex((f) => f.id === filter)}
            onChange={(i) => setFilter(FILTERS[i].id)}
            size="sm"
            color="#ffffff"
            activeTextColor="#0b0b10"
          />
        </div>
        <div className="flex gap-2 sm:hidden">
          {FILTERS.map((f) => (
            <Pill key={f.id} active={f.id === filter} onClick={() => setFilter(f.id)}>
              {f.label}
            </Pill>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Skeleton className="h-72 rounded-3xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
      ) : !data.items.length && !data.top ? (
        <div className="py-24 text-center">
          <p className="font-display text-2xl font-bold">No results for “{query}”</p>
          <p className="mt-2 text-ink-3">Check the spelling or try different keywords.</p>
        </div>
      ) : filter === 'all' ? (
        <div>
          <div className="mb-12 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {data.top && (
              <section>
                <SectionHeader title="Top result" />
                <TopResult item={data.top} />
              </section>
            )}
            {grouped.songs.length > 0 && (
              <section className={data.top ? '' : 'lg:col-span-2'}>
                <SectionHeader
                  title="Songs"
                  action={
                    <button type="button" onClick={() => setFilter('song')} className="text-sm font-semibold text-ink-3 hover:text-ink">
                      Show all
                    </button>
                  }
                />
                {grouped.songs.slice(0, 5).map((t, i) => (
                  <TrackRow key={t.id} track={t} showAlbum={false} onPlay={() => playTracks(grouped.songs, i)} />
                ))}
              </section>
            )}
          </div>
          <Shelf title="Artists" items={grouped.artists} />
          <Shelf title="Videos" items={grouped.videos} queueTitle={`Videos: ${query}`} />
          <Shelf title="Albums" items={grouped.albums} />
          <Shelf title="Playlists" items={grouped.playlists} />
        </div>
      ) : filter === 'song' || filter === 'video' ? (
        <div>
          {data.items.filter(isTrack).map((t, i, arr) => (
            <TrackRow key={t.id} track={t} onPlay={() => playTracks(arr, i)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-8">
          {data.items.map((it) => (
            <MediaCard key={`${it.kind}:${it.id}`} item={it} fluid />
          ))}
        </div>
      )}
    </div>
  );
}
