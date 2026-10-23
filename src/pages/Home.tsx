import { useMemo, useState } from 'react';
import { Heart, Play, Radio, Shuffle } from 'lucide-react';
import { useApi, q } from '../lib/api';
import type { HomeData, Item, RecommendData, Section, Track } from '../lib/types';
import { isTrack } from '../lib/types';
import { greeting, shuffle } from '../lib/format';
import { useListenAgain, useMixes, useSeeds, useSpeedDial, topTracks } from '../lib/recommend';
import { useLibrary } from '../store/library';
import { usePlayer, useCurrentTrack } from '../store/player';
import { useUI } from '../store/ui';
import { useAccount } from '../store/account';
import { useTweenedColors } from '../hooks/useAppEffects';
import { Shelf, SectionShelf, ShelfSkeleton } from '../components/media/Shelf';
import { BecauseHeader, EmptyTaste, MixedForYou, QuickPicks, SpeedDial } from '../components/home/HomeSections';
import { ErrorState, Pill, Skeleton } from '../components/ui/primitives';
import SplitText from '../components/rb/SplitText';
import RotatingText from '../components/rb/RotatingText';

const VIBES = ['late nights', 'deep focus', 'the commute', 'feeling good', 'your workout', 'slow mornings'];

function Hero() {
  const palette = useUI((s) => s.palette);
  const colors = useTweenedColors(palette.colors.slice(0, 3));
  const motionBg = useLibrary((s) => s.settings.motionBackgrounds);
  const likes = useLibrary((s) => s.likes);
  const trackStats = useLibrary((s) => s.trackStats);
  const current = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const player = usePlayer.getState;
  const favorites = topTracks(trackStats, 50);

  return (
    <section className="relative isolate -mx-4 -mt-16 mb-10 overflow-hidden px-4 pt-24 pb-10 sm:-mx-8 sm:px-8 sm:pt-28 sm:pb-12">
      <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
        {/* Aurora rendered washed-out white in Electron; the palette gradient is reliable. */}
        <div
          className="h-full w-full transition-[background] duration-1000"
          style={{ background: `radial-gradient(80% 100% at 20% 0%, ${colors[0]}, transparent 70%), radial-gradient(60% 90% at 85% 10%, ${colors[1] ?? colors[0]}, transparent 70%)`, opacity: motionBg ? 0.9 : 0.75 }}
        />
      </div>

      <p className="mb-2 text-sm font-semibold tracking-[0.18em] text-white/70 uppercase">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <SplitText
        text={`${greeting()}.`}
        tag="h1"
        className="font-display text-4xl font-bold tracking-tight sm:text-6xl"
        splitType="chars"
        effect="rise"
        delay={30}
        duration={0.8}
        trigger="load"
        textAlign="left"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-xl font-medium text-white/80 sm:text-2xl">
        <span>Music for</span>
        <RotatingText
          texts={VIBES}
          rotationInterval={2600}
          staggerDuration={0.02}
          mainClassName="overflow-hidden rounded-xl bg-white/10 px-3 py-0.5 text-white backdrop-blur"
          splitLevelClassName="overflow-hidden"
          transition={{ type: 'spring', damping: 26, stiffness: 380 }}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {current && !isPlaying && (
          <button
            type="button"
            onClick={() => player().play()}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_8px_30px_-8px_var(--accent)] transition hover:scale-105 active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" /> Resume “{current.title.length > 28 ? `${current.title.slice(0, 28)}…` : current.title}”
          </button>
        )}
        {likes.length > 0 && (
          <button
            type="button"
            onClick={() => player().playQueue(shuffle(likes), 0, { kind: 'liked', id: 'liked', title: 'Liked songs' })}
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 active:scale-95"
          >
            <Heart className="h-4 w-4" /> Shuffle liked songs
          </button>
        )}
        {favorites.length > 4 && (
          <button
            type="button"
            onClick={() => player().playQueue(shuffle(favorites), 0, { kind: 'mix', title: 'On repeat' })}
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 active:scale-95"
          >
            <Shuffle className="h-4 w-4" /> On repeat
          </button>
        )}
        {favorites[0] && (
          <button
            type="button"
            onClick={() => player().startRadio(favorites[0], 'My Supermix')}
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20 active:scale-95"
          >
            <Radio className="h-4 w-4" /> Supermix
          </button>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [mood, setMood] = useState<string | null>(null);
  const moodHome = useApi<HomeData>(mood ? `/home${q({ mood })}` : null);
  const baseHome = useApi<HomeData>('/home');
  const explore = useApi<{ sections: Section[] }>('/explore');
  const seeds = useSeeds();
  const rec = useApi<RecommendData>(seeds.length ? `/recommend${q({ seeds: seeds.join(',') })}` : null);
  const history = useLibrary((s) => s.history);
  const trackStats = useLibrary((s) => s.trackStats);
  const listenAgain = useListenAgain();
  const mixes = useMixes();
  const signedIn = useAccount((s) => !!s.status?.signedIn && !s.status.expired);
  const personalized = history.length > 0;

  // Fallback content for new listeners: trending + new releases.
  const fallbackDial = useMemo<Item[]>(() => {
    const ex = explore.data?.sections ?? [];
    const hs = baseHome.data?.sections ?? [];
    return [...(hs[0]?.items ?? []).slice(0, 4), ...(ex[0]?.items ?? []).slice(0, 4), ...(ex[1]?.items ?? []).slice(0, 4)];
  }, [explore.data, baseHome.data]);
  const dial = useSpeedDial(fallbackDial);

  // Without history, seed quick picks from what's trending.
  const trendingSeeds = useMemo(
    () =>
      (explore.data?.sections ?? [])
        .flatMap((s) => s.items)
        .filter(isTrack)
        .slice(0, 3)
        .map((t) => t.id),
    [explore.data],
  );
  const coldRec = useApi<RecommendData>(!seeds.length && trendingSeeds.length ? `/recommend${q({ seeds: trendingSeeds.join(',') })}` : null);
  const recData = rec.data ?? coldRec.data;

  const seedTrack = (id: string): Track | undefined =>
    trackStats[id]?.item ?? history.find((h) => h.track.id === id)?.track;

  const moods = baseHome.data?.moods ?? [];

  const ytmShelves = (
    <>
      {baseHome.error && <ErrorState error={baseHome.error} onRetry={baseHome.reload} />}
      {baseHome.loading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {baseHome.data?.sections.map((s, i) => {
        const subtitle = s.subtitle ?? (signedIn && i === 0 ? 'From your YouTube Music' : undefined);
        const songs = s.items.filter(isTrack);
        // Song-heavy shelves (YouTube Music's own "Quick picks") read best as the row grid.
        if (songs.length >= 8 && songs.length === s.items.length) {
          return <QuickPicks key={s.title} tracks={songs} title={s.title} subtitle={subtitle} />;
        }
        return <Shelf key={s.title} title={s.title} subtitle={subtitle} items={s.items} queueTitle={s.title} />;
      })}
    </>
  );

  return (
    <div>
      <Hero />

      {moods.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
          <Pill active={!mood} onClick={() => setMood(null)}>
            For you
          </Pill>
          {moods.map((m) => (
            <Pill key={m} active={mood === m} onClick={() => setMood(mood === m ? null : m)}>
              {m}
            </Pill>
          ))}
        </div>
      )}

      {mood ? (
        moodHome.error ? (
          <ErrorState error={moodHome.error} onRetry={moodHome.reload} />
        ) : moodHome.loading ? (
          <>
            <ShelfSkeleton />
            <ShelfSkeleton />
          </>
        ) : (
          moodHome.data?.sections.map((s) => <SectionShelf key={s.title} section={s} />)
        )
      ) : (
        <>
          {dial.length > 0 ? (
            <SpeedDial items={dial} personalized={personalized} />
          ) : (
            <Skeleton className="mb-12 h-[340px] rounded-[28px]" />
          )}

          {!personalized && !signedIn && <EmptyTaste />}

          {/* Signed in: the account's own personalized shelves lead the page. */}
          {signedIn && ytmShelves}

          {recData ? (
            <QuickPicks
              title="Recommended for you"
              tracks={recData.quickPicks}
              subtitle={personalized ? 'Based on your recent listening' : 'Trending right now'}
            />
          ) : (
            (rec.loading || coldRec.loading || (!seeds.length && explore.loading)) && <ShelfSkeleton count={4} />
          )}

          <MixedForYou mixes={mixes} />

          {listenAgain.length > 0 && <Shelf title="Listen again" subtitle="Jump back in" items={listenAgain} queueTitle="Listen again" />}

          {personalized &&
            recData?.because.slice(0, 2).map((b) => {
              const seed = seedTrack(b.seed);
              if (!seed || !b.items.length) return null;
              return <Shelf key={b.seed} title={<BecauseHeader seed={seed} />} items={b.items} queueTitle={`Because you listened to ${seed.title}`} />;
            })}

          {recData && recData.artists.length > 0 && (
            <Shelf title={personalized ? 'Artists you might like' : 'Artists to explore'} subtitle="Recommended" items={recData.artists} />
          )}
          {recData && recData.playlists.length > 0 && (
            <Shelf title="Recommended playlists" items={recData.playlists} />
          )}

          {!signedIn && ytmShelves}
          {explore.data?.sections.map((s) => <SectionShelf key={`ex-${s.title}`} section={s} />)}
        </>
      )}
    </div>
  );
}
