import { useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Pin, Play, Sparkles } from 'lucide-react';
import type { Track } from '../../lib/types';
import { isTrack } from '../../lib/types';
import { itemHref } from '../../lib/format';
import { playItem } from '../../lib/actions';
import type { DialItem, Mix } from '../../lib/recommend';
import { usePlayer } from '../../store/player';
import { useUI } from '../../store/ui';
import { Artwork, SectionHeader, cx } from '../ui/primitives';
import { Scroller } from '../media/Shelf';
import { TrackRow } from '../media/TrackRow';
import SpotlightCard from '../rb/SpotlightCard';
import AnimatedContent from '../rb/AnimatedContent';

// ---------------------------------------------------------------------------
// Speed dial
// ---------------------------------------------------------------------------

function DialTile({ d }: { d: DialItem }) {
  const navigate = useNavigate();
  const openMenu = useUI((s) => s.openMenu);
  const { item } = d;
  const isCurrent = usePlayer((s) => {
    const cur = s.queue[s.index]?.track;
    if (!cur) return false;
    return isTrack(item) ? cur.id === item.id : s.source?.id === item.id;
  });
  const isPlaying = usePlayer((s) => s.isPlaying);
  const art = item.thumbnail ?? d.art;
  const round = item.kind === 'artist';

  const play = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (isCurrent) usePlayer.getState().toggle();
    else void playItem(item);
  };
  const open = () => {
    const href = itemHref(item);
    if (href) navigate(href);
    else play();
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu({ item, x: e.clientX, y: e.clientY });
      }}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {round ? (
        <>
          <Artwork src={art} className="absolute inset-0 h-full w-full scale-125 blur-2xl brightness-75" rounded="xl" />
          <div className="absolute inset-[14%] bottom-[24%]">
            <Artwork src={art} className="h-full w-full shadow-2xl transition-transform duration-500 group-hover:scale-105" rounded="full" />
          </div>
        </>
      ) : (
        <Artwork src={art} className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.07]" rounded="xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {d.pinned && (
        <span className="absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 backdrop-blur" title="Pinned">
          <Pin className="h-3 w-3 fill-current" />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
        <p className={cx('line-clamp-2 text-[13px] leading-tight font-semibold sm:text-sm', round && 'text-center', isCurrent && 'text-accent')}>
          {item.title}
        </p>
      </div>
      <button
        type="button"
        onClick={play}
        aria-label={isCurrent && isPlaying ? 'Pause' : `Play ${item.title}`}
        className={cx(
          'absolute top-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-lg transition-all duration-300 hover:scale-110',
          isCurrent ? 'opacity-100' : 'scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {isCurrent && isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
    </div>
  );
}

export function SpeedDial({ items, personalized }: { items: DialItem[]; personalized: boolean }) {
  if (!items.length) return null;
  return (
    <AnimatedContent distance={30} duration={0.7} blur={8} className="mb-12">
      <SpotlightCard
        className="rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-4 sm:p-6"
        spotlightColor="color-mix(in srgb, var(--accent) 22%, transparent)"
        spotlightSize={520}
      >
        <SectionHeader
          title="Speed dial"
          subtitle={personalized ? 'Your go-to music' : 'Start here'}
          action={
            <span className="hidden text-xs text-ink-3 sm:block">Right-click anything → Pin to Speed dial</span>
          }
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {items.map((d) => (
            <DialTile key={`${d.item.kind}:${d.item.id}`} d={d} />
          ))}
        </div>
      </SpotlightCard>
    </AnimatedContent>
  );
}

// ---------------------------------------------------------------------------
// Quick picks — YouTube Music's signature 4-row song grid
// ---------------------------------------------------------------------------

export function QuickPicks({ tracks, title = 'Quick picks', subtitle }: { tracks: Track[]; title?: string; subtitle?: string }) {
  const columns = useMemo(() => {
    const cols: Track[][] = [];
    for (let i = 0; i < tracks.length; i += 4) cols.push(tracks.slice(i, i + 4));
    return cols;
  }, [tracks]);
  if (!tracks.length) return null;
  const play = (i: number) => usePlayer.getState().playQueue(tracks, i, { kind: 'mix', title });
  return (
    <AnimatedContent distance={40} duration={0.7} blur={6} className="mb-12">
      <section>
        <SectionHeader
          title={title}
          subtitle={subtitle}
          action={
            <button
              type="button"
              onClick={() => play(0)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Play all
            </button>
          }
        />
        <Scroller>
          {columns.map((col, c) => (
            <div key={c} className="w-[min(380px,85vw)] shrink-0">
              {col.map((t, r) => (
                <TrackRow key={t.id} track={t} showAlbum={false} compact onPlay={() => play(c * 4 + r)} />
              ))}
            </div>
          ))}
        </Scroller>
      </section>
    </AnimatedContent>
  );
}

// ---------------------------------------------------------------------------
// Mixed for you
// ---------------------------------------------------------------------------

function MixCard({ mix }: { mix: Mix }) {
  const startRadio = usePlayer((s) => s.startRadio);
  const isCurrent = usePlayer((s) => s.source?.kind === 'radio' && s.source.title === mix.title);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const play = () => (isCurrent ? usePlayer.getState().toggle() : startRadio(mix.seed, mix.title));
  return (
    <button type="button" onClick={play} className="group w-44 shrink-0 text-left sm:w-52">
      <div
        className="relative aspect-square overflow-hidden rounded-2xl shadow-[0_10px_40px_-14px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:-translate-y-1"
        style={{ background: `linear-gradient(145deg, hsl(${mix.hue}, 80%, 55%), hsl(${(mix.hue + 50) % 360}, 70%, 22%))` }}
      >
        {/* Fanned artwork stack. */}
        {mix.art.map((a, i) => (
          <div
            key={a}
            className="absolute top-[18%] left-1/2 w-[52%] transition-transform duration-500"
            style={{
              transform: `translateX(-50%) translateX(${(i - (mix.art.length - 1) / 2) * 26}%) rotate(${(i - (mix.art.length - 1) / 2) * 9}deg)`,
              zIndex: i === Math.floor(mix.art.length / 2) ? 3 : 1,
            }}
          >
            <Artwork src={a} className="aspect-square w-full shadow-xl ring-1 ring-black/20" rounded="lg" />
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
          <p className="font-display text-lg leading-tight font-bold">{mix.title}</p>
        </div>
        <span
          className={cx(
            'absolute right-3 bottom-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-xl transition-all duration-300',
            isCurrent ? 'opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100',
          )}
        >
          {isCurrent && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </span>
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm text-ink-3">{mix.subtitle}</p>
    </button>
  );
}

export function MixedForYou({ mixes }: { mixes: Mix[] }) {
  if (!mixes.length) return null;
  return (
    <AnimatedContent distance={40} duration={0.7} blur={6} className="mb-12">
      <section>
        <SectionHeader title="Mixed for you" subtitle="Endless radio from your taste" />
        <Scroller>
          {mixes.map((m) => (
            <MixCard key={m.id} mix={m} />
          ))}
        </Scroller>
      </section>
    </AnimatedContent>
  );
}

// ---------------------------------------------------------------------------
// "Because you listened to …" header with the seed's artwork
// ---------------------------------------------------------------------------

export function BecauseHeader({ seed }: { seed: Track }) {
  return (
    <span className="flex items-center gap-3">
      <Artwork src={seed.thumbnail} className="h-10 w-10 shrink-0" rounded="md" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Because you listened to</span>
        <span className="block truncate">{seed.title}</span>
      </span>
    </span>
  );
}

export function EmptyTaste() {
  return (
    <div className="mb-12 flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-gradient-to-r from-white/[0.05] to-transparent p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2">
        <Sparkles className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold">Your recommendations start here</p>
        <p className="text-sm text-ink-3">
          Play a few songs. Speed dial, Mixed for you and Quick picks adapt to what you listen to.
        </p>
      </div>
    </div>
  );
}
