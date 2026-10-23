import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react';
import { GripVertical, Radio, X } from 'lucide-react';
import { usePlayer, useCurrentTrack, type QueueItem } from '../../store/player';
import { useLibrary } from '../../store/library';
import { useUI } from '../../store/ui';
import { useApi, lyricsPath } from '../../lib/api';
import type { LyricLine, LyricsData, RelatedData } from '../../lib/types';
import { isTrack } from '../../lib/types';
import { formatTime, artistNames } from '../../lib/format';
import { Artwork, Equalizer, Skeleton, cx } from '../ui/primitives';
import { MediaCard } from '../media/MediaCard';
import { Scroller } from '../media/Shelf';
import { TrackRow } from '../media/TrackRow';
import ShinyText from '../rb/ShinyText';
import SquishSwitch from '../rb/SquishSwitch';
import { usePlaybackClock } from '../../hooks/usePlaybackClock';

// ---------------------------------------------------------------------------
// Up next
// ---------------------------------------------------------------------------

const PAGE = 60;

function QueueRow({ item, index, isCurrent }: { item: QueueItem; index: number; isCurrent: boolean }) {
  const controls = useDragControls();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const openMenu = useUI((s) => s.openMenu);
  const t = item.track;
  const rowClass =
    'group relative flex items-center gap-3 rounded-xl px-2 py-2 select-none hover:bg-white/[0.06] data-[current=true]:bg-white/[0.09]';
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    openMenu({
      item: t,
      x: e.clientX,
      y: e.clientY,
      extra: isCurrent ? undefined : [{ label: 'Remove from queue', danger: true, onSelect: () => usePlayer.getState().removeAt(index) }],
    });
  };
  const body = (
    <>
      {isCurrent ? (
        <span className="hidden w-5 shrink-0 sm:block" />
      ) : (
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className="hidden h-8 w-5 shrink-0 cursor-grab touch-none place-items-center text-ink-3 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing sm:grid"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => (isCurrent ? usePlayer.getState().toggle() : usePlayer.getState().jumpTo(index))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="relative h-11 w-11 shrink-0">
          <Artwork src={t.thumbnail} className="h-full w-full" rounded="md" />
          {isCurrent && (
            <span className="absolute inset-0 grid place-items-center rounded-md bg-black/55">
              <Equalizer playing={isPlaying} />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className={cx('block truncate text-sm font-medium', isCurrent && 'text-accent')}>{t.title}</span>
          <span className="block truncate text-xs text-ink-3">{artistNames(t)}</span>
        </span>
      </button>
      <span className="text-xs tabular-nums text-ink-3 group-hover:hidden">{t.duration ? formatTime(t.duration) : ''}</span>
      {!isCurrent && (
        <button
          type="button"
          aria-label="Remove from queue"
          onClick={() => usePlayer.getState().removeAt(index)}
          className="hidden h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink group-hover:grid"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </>
  );

  if (isCurrent) {
    return (
      <div className={rowClass} data-current onContextMenu={onContextMenu}>
        {body}
      </div>
    );
  }
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className={rowClass}
      whileDrag={{ scale: 1.02, boxShadow: '0 16px 40px -12px rgba(0,0,0,0.8)', backgroundColor: 'rgba(40,40,52,0.95)' }}
      onContextMenu={onContextMenu}
    >
      {body}
    </Reorder.Item>
  );
}

export function UpNextPanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const source = usePlayer((s) => s.source);
  const radioLoading = usePlayer((s) => s.radioLoading);
  const autoplay = useLibrary((s) => s.settings.autoplay);
  const setSetting = useLibrary((s) => s.setSetting);
  const [limit, setLimit] = useState(PAGE);

  const upcoming = useMemo(() => queue.slice(index + 1, index + 1 + limit), [queue, index, limit]);
  const remaining = Math.max(0, queue.length - (index + 1) - upcoming.length);
  const current = queue[index];
  const history = queue.slice(Math.max(0, index - 3), index);

  const onReorder = (next: QueueItem[]) => {
    const s = usePlayer.getState();
    const head = s.queue.slice(0, s.index + 1);
    const tail = s.queue.slice(s.index + 1 + next.length);
    usePlayer.setState({ queue: [...head, ...next, ...tail] });
  };

  if (!current) return <p className="py-16 text-center text-sm text-ink-3">Nothing in the queue yet.</p>;

  return (
    <div className="pb-6">
      {source && (
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase">Playing from</p>
            <ShinyText text={source.title} className="block truncate text-sm font-semibold" speed={3} color="#d9d7e3" shineColor="#ffffff" />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-ink-2">
            <Radio className="h-3.5 w-3.5" /> Autoplay
            <SquishSwitch
              checked={autoplay}
              onChange={(v) => setSetting('autoplay', v)}
              width={38}
              height={22}
              trackOnColor="var(--accent)"
              ariaLabel="Autoplay similar songs"
            />
          </label>
        </div>
      )}

      {history.length > 0 && (
        <div className="opacity-50 transition-opacity hover:opacity-100">
          {history.map((it, i) => (
            <QueueRowStatic key={it.uid} item={it} index={index - history.length + i} />
          ))}
        </div>
      )}

      <div className="mt-1">
        <QueueRow item={current} index={index} isCurrent />
      </div>

      {upcoming.length > 0 && (
        <p className="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase">
          Next up • {queue.length - index - 1}
        </p>
      )}
      <Reorder.Group axis="y" values={upcoming} onReorder={onReorder} layoutScroll>
        {upcoming.map((it, i) => (
          <QueueRow key={it.uid} item={it} index={index + 1 + i} isCurrent={false} />
        ))}
      </Reorder.Group>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="mx-auto mt-3 block rounded-full bg-white/[0.07] px-4 py-1.5 text-xs font-medium hover:bg-white/[0.12]"
        >
          Show {Math.min(PAGE, remaining)} more
        </button>
      )}
      {radioLoading && (
        <div className="mt-3 space-y-2 px-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <button
          type="button"
          onClick={() => usePlayer.getState().clearUpcoming()}
          className="mx-auto mt-5 block text-xs font-medium text-ink-3 hover:text-ink"
        >
          Clear upcoming
        </button>
      )}
    </div>
  );
}

function QueueRowStatic({ item, index }: { item: QueueItem; index: number }) {
  const t = item.track;
  return (
    <button
      type="button"
      onClick={() => usePlayer.getState().jumpTo(index)}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.06] sm:pl-9"
    >
      <Artwork src={t.thumbnail} className="h-11 w-11 shrink-0" rounded="md" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{t.title}</span>
        <span className="block truncate text-xs text-ink-3">{artistNames(t)}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lyrics
// ---------------------------------------------------------------------------

const OFFSETS_KEY = 'pulse.lyricOffsets';

function readOffset(id: string): number {
  try {
    return (JSON.parse(localStorage.getItem(OFFSETS_KEY) ?? '{}') as Record<string, number>)[id] ?? 0;
  } catch {
    return 0;
  }
}

function writeOffset(id: string, v: number) {
  try {
    const all = JSON.parse(localStorage.getItem(OFFSETS_KEY) ?? '{}') as Record<string, number>;
    if (v) all[id] = v;
    else delete all[id];
    localStorage.setItem(OFFSETS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

/** Index of the last line whose start time has passed (binary search). */
function lineAt(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Splits a line into words with the fraction of the line at which each starts. */
function wordsOf(text: string): { w: string; at: number; len: number }[] {
  const words = text.split(/(\s+)/).filter(Boolean);
  const total = text.replace(/\s+/g, '').length || 1;
  let acc = 0;
  return words.map((w) => {
    const len = w.trim().length;
    const at = acc / total;
    acc += len;
    return { w, at, len: len / total };
  });
}

interface SyncedProps {
  lines: LyricLine[];
  trackId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  source: string | null;
}

function SyncedLyrics({ lines, trackId, scrollRef, source }: SyncedProps) {
  const seek = usePlayer((s) => s.seek);
  const duration = usePlayer((s) => s.duration);
  const [active, setActive] = useState(-1);
  const [offset, setOffset] = useState(() => readOffset(trackId));
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef(-1);
  const userScrolledAt = useRef(0);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  useEffect(() => {
    setOffset(readOffset(trackId));
    activeRef.current = -1;
    setActive(-1);
  }, [trackId]);

  usePlaybackClock((now) => {
    // Lead slightly so the highlight lands as the line is sung, not after.
    const t = now + 0.15 + offsetRef.current;
    const i = lineAt(lines, t);
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
    }
    const el = i >= 0 ? lineRefs.current[i] : null;
    if (!el) return;
    const start = lines[i].t;
    const end = lines[i + 1]?.t ?? Math.max(start + 4, duration || start + 4);
    // Vocals rarely fill the whole gap before the next line; finish the wipe early.
    const span = Math.max(0.6, Math.min(end - start, 8) * 0.92);
    const p = Math.max(0, Math.min(1, (t - start) / span));
    el.querySelectorAll<HTMLSpanElement>('[data-at]').forEach((w) => {
      const at = Number(w.dataset.at);
      const len = Number(w.dataset.len) || 0.0001;
      w.style.setProperty('--fill', String(Math.max(0, Math.min(1, (p - at) / len))));
    });
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mark = () => (userScrolledAt.current = Date.now());
    el.addEventListener('wheel', mark, { passive: true });
    el.addEventListener('touchmove', mark, { passive: true });
    return () => {
      el.removeEventListener('wheel', mark);
      el.removeEventListener('touchmove', mark);
    };
  }, [scrollRef]);

  useEffect(() => {
    const box = scrollRef.current;
    const line = lineRefs.current[active];
    if (!box || !line || Date.now() - userScrolledAt.current < 3500) return;
    const boxRect = box.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    box.scrollTo({ top: box.scrollTop + (lineRect.top - boxRect.top) - box.clientHeight * 0.36, behavior: 'smooth' });
  }, [active, scrollRef]);

  const nudge = (d: number) => {
    const v = Math.round((offset + d) * 100) / 100;
    setOffset(v);
    writeOffset(trackId, v);
  };

  return (
    <div className="px-2 pt-6 pb-[40vh]">
      {lines.map((l, i) => {
        const state = i === active ? 'now' : i < active ? 'past' : 'next';
        return (
          <button
            key={`${l.t}-${i}`}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            type="button"
            onClick={() => {
              userScrolledAt.current = 0;
              seek(Math.max(0, l.t - offset));
            }}
            className={cx(
              'block w-full origin-left py-2 text-left font-display text-2xl leading-snug font-bold tracking-tight transition-[transform,color,filter] duration-500 sm:text-[28px]',
              state === 'now' && 'scale-100 [text-shadow:0_0_36px_color-mix(in_srgb,var(--accent)_55%,transparent)]',
              state === 'past' && 'scale-[0.97] text-white/35 hover:text-white/70',
              state === 'next' && 'scale-[0.97] text-white/45 blur-[0.4px] hover:text-white/80 hover:blur-none',
            )}
          >
            {state === 'now' && l.text
              ? wordsOf(l.text).map((w, k) =>
                  w.len ? (
                    <span
                      key={k}
                      data-at={w.at}
                      data-len={w.len}
                      className="bg-clip-text text-transparent [background-image:linear-gradient(90deg,#fff_calc(var(--fill,0)*100%),rgba(255,255,255,0.42)_calc(var(--fill,0)*100%))]"
                    >
                      {w.w}
                    </span>
                  ) : (
                    <span key={k}>{w.w}</span>
                  ),
                )
              : l.text || '♪'}
          </button>
        );
      })}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
        <span>{source ? `Lyrics provided by ${source}` : ''}</span>
        <span className="flex items-center gap-1.5">
          Out of sync?
          <button type="button" onClick={() => nudge(-0.25)} className="rounded-full bg-white/10 px-2 py-1 font-semibold text-ink hover:bg-white/20">
            −0.25s
          </button>
          <span className="w-12 text-center tabular-nums">
            {offset > 0 ? '+' : ''}
            {offset.toFixed(2)}s
          </span>
          <button type="button" onClick={() => nudge(0.25)} className="rounded-full bg-white/10 px-2 py-1 font-semibold text-ink hover:bg-white/20">
            +0.25s
          </button>
        </span>
      </div>
    </div>
  );
}

export function LyricsPanel({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const track = useCurrentTrack();
  const { data, loading, error } = useApi<LyricsData>(track ? lyricsPath(track) : null);

  if (!track) return null;
  if (loading) {
    return (
      <div className="space-y-4 px-2 py-6">
        {[80, 60, 72, 45, 66, 52].map((w, i) => (
          <div key={i} className="skeleton h-7 rounded-lg" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (error || (!data?.synced && !data?.plain)) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-lg font-semibold">No lyrics for this one</p>
        <p className="mt-1 text-sm text-ink-3">Lyrics aren&apos;t available for “{track.title}”.</p>
      </div>
    );
  }
  if (data.synced) return <SyncedLyrics lines={data.synced} trackId={track.id} scrollRef={scrollRef} source={data.source} />;
  return (
    <div className="px-2 py-6">
      <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-ink-2">
        Time-synced lyrics aren&apos;t available for this song, so here&apos;s the full text
      </p>
      <p className="font-display text-xl leading-relaxed font-semibold whitespace-pre-line text-white/85">{data.plain}</p>
      {data.source && <p className="mt-8 text-xs text-ink-3">Source: {data.source}</p>}
    </div>
  );
}

/** The current synced line on its own — shown under the title in Now Playing. */
export function LiveLyric({ className }: { className?: string }) {
  const track = useCurrentTrack();
  const { data } = useApi<LyricsData>(track ? lyricsPath(track) : null);
  const lines = data?.synced ?? null;
  const [i, setI] = useState(-1);
  const iRef = useRef(-1);
  const offset = track ? readOffset(track.id) : 0;
  usePlaybackClock((now) => {
    if (!lines) return;
    const n = lineAt(lines, now + 0.15 + offset);
    if (n !== iRef.current) {
      iRef.current = n;
      setI(n);
    }
  }, !!lines);
  if (!lines) return null;
  const text = i >= 0 ? lines[i].text : '';
  return (
    <div className={cx('relative h-7 overflow-hidden', className)} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={`${i}-${text}`}
          initial={{ y: 18, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -18, opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 truncate text-base font-semibold text-white/85"
        >
          {text || '♪'}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Related
// ---------------------------------------------------------------------------

export function RelatedPanel() {
  const track = useCurrentTrack();
  const { data, loading } = useApi<RelatedData>(track ? `/related/${track.id}` : null);
  if (!track) return null;
  if (loading) {
    return (
      <div className="space-y-3 px-2 py-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!data?.sections.length) return <p className="py-16 text-center text-sm text-ink-3">No related content found.</p>;

  return (
    <div className="space-y-8 pb-8">
      {data.sections.map((s) => {
        const tracks = s.items.filter(isTrack);
        if (tracks.length === s.items.length) {
          return (
            <section key={s.title}>
              <h3 className="mb-2 px-2 font-display text-lg font-bold">{s.title}</h3>
              {tracks.slice(0, 10).map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  compact
                  showAlbum={false}
                  onPlay={() => usePlayer.getState().playQueue(tracks, i, { kind: 'radio', title: s.title })}
                />
              ))}
            </section>
          );
        }
        return (
          <section key={s.title}>
            <h3 className="mb-3 px-2 font-display text-lg font-bold">{s.title}</h3>
            <div className="px-2">
              <Scroller>
                {s.items.map((it) => (
                  <MediaCard key={`${it.kind}:${it.id}`} item={it} />
                ))}
              </Scroller>
            </div>
          </section>
        );
      })}
      {data.about && (
        <section className="mx-2 rounded-2xl bg-white/[0.05] p-5">
          <h3 className="mb-2 font-display text-lg font-bold">About the artist</h3>
          <p className="line-clamp-[10] text-sm leading-relaxed whitespace-pre-line text-ink-2">{data.about}</p>
        </section>
      )}
    </div>
  );
}
