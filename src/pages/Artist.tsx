import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Radio, Shuffle, Play, Pause } from 'lucide-react';
import { useApi } from '../lib/api';
import type { ArtistData, Collection } from '../lib/types';
import { usePlayer } from '../store/player';
import { rememberArtistThumb } from '../store/library';
import { SectionShelf } from '../components/media/Shelf';
import { TrackRow } from '../components/media/TrackRow';
import { useScenePalette } from '../hooks/useScene';
import { ErrorState, SectionHeader, Skeleton } from '../components/ui/primitives';
import { SaveButtons } from './Album';
import ScrollVelocity from '../components/rb/ScrollVelocity';
import SplitText from '../components/rb/SplitText';
import { mainScrollRef } from '../lib/scroll';

export default function Artist() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<ArtistData>(`/artist/${id}`);
  const [showAll, setShowAll] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const palette = useScenePalette(`artist:${id}`, data?.avatar);
  const isThis = usePlayer((s) => s.source?.kind === 'artist' && s.source.id === id && s.index >= 0);
  const isPlaying = usePlayer((s) => s.isPlaying);

  useEffect(() => {
    setShowAll(false);
    setBioOpen(false);
  }, [id]);

  useEffect(() => {
    if (data) rememberArtistThumb(id, data.name, data.avatar);
  }, [data, id]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) {
    return (
      <div>
        <Skeleton className="-mx-4 -mt-16 mb-8 h-[46vh] rounded-none sm:-mx-8" />
        <Skeleton className="mb-4 h-8 w-48" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-14" />
        ))}
      </div>
    );
  }

  const item: Collection = { kind: 'artist', id, title: data.name, thumbnail: data.avatar, subtitle: data.subscribers };
  const source = { kind: 'artist' as const, id, title: data.name, thumbnail: data.avatar };
  const songs = showAll ? data.songs : data.songs.slice(0, 5);
  const player = usePlayer.getState;

  return (
    <div>
      <header className="relative isolate -mx-4 -mt-16 mb-8 flex min-h-[46vh] items-end overflow-hidden px-4 pt-24 pb-8 sm:-mx-8 sm:min-h-[52vh] sm:px-8">
        {data.banner && (
          <img
            src={data.banner}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_25%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
            draggable={false}
          />
        )}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(180deg, rgba(7,7,11,0.1) 0%, rgba(7,7,11,0.3) 50%, color-mix(in srgb, ${palette.deep} 45%, transparent) 85%, transparent 100%)`,
          }}
        />
        <div className="w-full">
          {data.subscribers && <p className="mb-2 text-sm font-semibold text-white/80">{data.subscribers}</p>}
          <SplitText
            key={data.name}
            text={data.name}
            tag="h1"
            className="font-display text-5xl leading-none font-bold tracking-tighter drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:text-7xl lg:text-8xl"
            splitType="chars"
            effect="rise"
            delay={25}
            trigger="load"
            textAlign="left"
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!data.songs.length}
              onClick={() => (isThis ? player().toggle() : player().playQueue(data.songs, 0, source, { shuffle: false }))}
              className="flex h-12 items-center gap-2 rounded-full bg-white pr-6 pl-5 font-semibold text-black shadow-[0_10px_40px_-10px_var(--accent)] transition hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              {isThis && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              {isThis && isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              disabled={!data.songs.length}
              onClick={() => player().playQueue(data.songs, 0, source, { shuffle: true })}
              className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-semibold backdrop-blur transition hover:bg-white/25 active:scale-95"
            >
              <Shuffle className="h-5 w-5" /> Shuffle
            </button>
            <button
              type="button"
              disabled={!data.songs.length}
              onClick={() => data.songs[0] && player().startRadio(data.songs[0], `${data.name} Radio`)}
              className="flex h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-semibold backdrop-blur transition hover:bg-white/25 active:scale-95"
            >
              <Radio className="h-5 w-5" /> Radio
            </button>
            <SaveButtons item={item} />
          </div>
        </div>
      </header>

      <div className="pointer-events-none -mx-4 mb-10 overflow-hidden opacity-[0.07] select-none sm:-mx-8" aria-hidden="true">
        <ScrollVelocity
          texts={[`${data.name} •`]}
          velocity={40}
          className="font-display font-bold tracking-tighter"
          fontSize="clamp(56px, 9vw, 120px)"
          numCopies={6}
          scrollContainerRef={mainScrollRef}
        />
      </div>

      {data.songs.length > 0 && (
        <section className="mb-12">
          <SectionHeader title="Top songs" />
          {songs.map((t, i) => (
            <TrackRow key={t.id} track={t} onPlay={() => player().playQueue(data.songs, i, source, { shuffle: false })} />
          ))}
          {data.songs.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold hover:bg-white/10"
            >
              {showAll ? 'Show less' : `Show all ${data.songs.length}`}
            </button>
          )}
        </section>
      )}

      {data.sections.map((s) => (
        <SectionShelf key={s.title} section={s} />
      ))}

      {data.description && (
        <section className="mb-12 max-w-3xl rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6">
          <SectionHeader title={`About ${data.name}`} />
          <p className={`text-[15px] leading-relaxed whitespace-pre-line text-ink-2 ${bioOpen ? '' : 'line-clamp-5'}`}>
            {data.description}
          </p>
          <button type="button" onClick={() => setBioOpen((v) => !v)} className="mt-3 text-sm font-semibold text-accent hover:underline">
            {bioOpen ? 'Show less' : 'Read more'}
          </button>
        </section>
      )}
    </div>
  );
}
