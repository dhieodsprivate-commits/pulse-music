import { useNavigate, useParams } from 'react-router-dom';
import { Disc3, Flame, Sparkles } from 'lucide-react';
import { useApi, q } from '../lib/api';
import type { HomeData, Section } from '../lib/types';
import { isTrack } from '../lib/types';
import { usePlayer } from '../store/player';
import { SectionShelf, ShelfSkeleton } from '../components/media/Shelf';
import { TrackRow } from '../components/media/TrackRow';
import { ErrorState, SectionHeader, Skeleton } from '../components/ui/primitives';
import BlurText from '../components/rb/BlurText';
import GlareHover from '../components/rb/GlareHover';
import AnimatedContent from '../components/rb/AnimatedContent';
import { MOOD_STYLES } from '../lib/moods';

function MoodGrid({ moods }: { moods: string[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {moods.map((m, i) => (
        <GlareHover
          key={m}
          width="100%"
          height="112px"
          borderRadius="20px"
          background={MOOD_STYLES[i % MOOD_STYLES.length]}
          borderColor="rgba(255,255,255,0.08)"
          glareOpacity={0.35}
          glareSize={260}
          className="cursor-pointer transition-transform duration-300 hover:-translate-y-1"
        >
          <button
            type="button"
            onClick={() => navigate(`/mood/${encodeURIComponent(m)}`)}
            className="absolute inset-0 flex items-end p-4 text-left font-display text-xl font-bold tracking-tight"
          >
            {m}
          </button>
        </GlareHover>
      ))}
    </div>
  );
}

function Chart({ section }: { section: Section }) {
  const tracks = section.items.filter(isTrack);
  if (!tracks.length) return <SectionShelf section={section} />;
  const half = Math.ceil(Math.min(tracks.length, 20) / 2);
  const cols = [tracks.slice(0, half), tracks.slice(half, 20)];
  const play = (i: number) => usePlayer.getState().playQueue(tracks, i, { kind: 'mix', title: section.title });
  return (
    <AnimatedContent distance={40} duration={0.7} blur={6} className="mb-12">
      <section>
        <SectionHeader title={<span className="flex items-center gap-2"><Flame className="h-6 w-6 text-accent" /> {section.title}</span>} subtitle="Chart" />
        <div className="grid gap-x-8 lg:grid-cols-2">
          {cols.map((col, c) => (
            <div key={c}>
              {col.map((t, r) => {
                const i = c * half + r;
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-7 shrink-0 text-right font-display text-lg font-bold text-ink-3 tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <TrackRow track={t} showAlbum={false} onPlay={() => play(i)} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </AnimatedContent>
  );
}

export default function Explore() {
  const explore = useApi<{ sections: Section[] }>('/explore');
  const home = useApi<HomeData>('/home');
  return (
    <div>
      <header className="mb-10 pt-2">
        <BlurText text="Explore" className="font-display text-4xl font-bold tracking-tight sm:text-6xl" animateBy="letters" delay={40} />
        <p className="mt-2 flex items-center gap-2 text-ink-2">
          <Sparkles className="h-4 w-4 text-accent" /> New releases, charts and moods — fresh from YouTube Music.
        </p>
      </header>

      <section className="mb-12">
        <SectionHeader title="Moods & moments" />
        {home.data ? <MoodGrid moods={home.data.moods} /> : <Skeleton className="h-60 rounded-3xl" />}
      </section>

      {explore.error && <ErrorState error={explore.error} onRetry={explore.reload} />}
      {explore.loading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {explore.data?.sections.map((s) =>
        /trending/i.test(s.title) ? <Chart key={s.title} section={s} /> : <SectionShelf key={s.title} section={s} />,
      )}
    </div>
  );
}

export function Mood() {
  const { name = '' } = useParams();
  const mood = decodeURIComponent(name);
  const { data, error, loading, reload } = useApi<HomeData>(`/home${q({ mood })}`);
  return (
    <div>
      <header className="relative isolate -mx-4 -mt-16 mb-10 overflow-hidden px-4 pt-28 pb-10 sm:-mx-8 sm:px-8">
        <div
          className="absolute inset-0 -z-10 opacity-60 [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
          style={{ background: MOOD_STYLES[Math.abs(hash(mood)) % MOOD_STYLES.length] }}
        />
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-white/75 uppercase">
          <Disc3 className="h-4 w-4" /> Mood
        </p>
        <BlurText key={mood} text={mood} className="mt-2 font-display text-5xl font-bold tracking-tight sm:text-7xl" animateBy="letters" delay={40} />
      </header>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {data?.sections.map((s) => <SectionShelf key={s.title} section={s} />)}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
