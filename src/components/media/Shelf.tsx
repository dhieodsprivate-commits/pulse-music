import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Item, Section } from '../../lib/types';
import { isTrack } from '../../lib/types';
import { usePlayer } from '../../store/player';
import { MediaCard } from './MediaCard';
import { SectionHeader, Skeleton, cx } from '../ui/primitives';
import AnimatedContent from '../rb/AnimatedContent';

/** Horizontal, snap-scrolling row with paging buttons. */
export function Scroller({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className={cx('group/scroller relative', className)}>
      <div
        ref={ref}
        onScroll={measure}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:scroll-px-8 sm:gap-5 sm:px-8 [&>*]:snap-start"
      >
        {children}
      </div>
      {(['left', 'right'] as const).map((side) => {
        const hidden = side === 'left' ? edges.start : edges.end;
        return (
          <button
            key={side}
            type="button"
            aria-label={side === 'left' ? 'Scroll left' : 'Scroll right'}
            onClick={() => page(side === 'left' ? -1 : 1)}
            className={cx(
              'absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-surface-2/90 text-ink shadow-xl backdrop-blur transition-all duration-200 hover:scale-110 hover:bg-surface-3 md:grid',
              side === 'left' ? '-left-3' : '-right-3',
              hidden ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/scroller:opacity-100',
            )}
          >
            {side === 'left' ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        );
      })}
    </div>
  );
}

interface ShelfProps {
  title: ReactNode;
  subtitle?: ReactNode;
  items: Item[];
  action?: ReactNode;
  size?: 'md' | 'lg';
  /** When the shelf is all tracks, clicking one plays the shelf as a queue. */
  queueTitle?: string;
}

export function Shelf({ title, subtitle, items, action, size, queueTitle }: ShelfProps) {
  if (!items.length) return null;
  const tracks = items.filter(isTrack);
  const allTracks = tracks.length === items.length;
  return (
    <AnimatedContent distance={40} duration={0.7} blur={6} threshold={0.05} className="mb-10">
      <section>
        <SectionHeader title={title} subtitle={subtitle} action={action} />
        <Scroller>
          {items.map((it, i) => (
            <MediaCard
              key={`${it.kind}:${it.id}:${i}`}
              item={it}
              size={size}
              onPlay={
                allTracks && queueTitle
                  ? () => usePlayer.getState().playQueue(tracks, i, { kind: 'home', title: queueTitle })
                  : undefined
              }
            />
          ))}
        </Scroller>
      </section>
    </AnimatedContent>
  );
}

export function SectionShelf({ section }: { section: Section }) {
  return <Shelf title={section.title} subtitle={section.subtitle} items={section.items} queueTitle={section.title} />;
}

export function ShelfSkeleton({ count = 6, round = false }: { count?: number; round?: boolean }) {
  return (
    <div className="mb-10">
      <Skeleton className="mb-5 h-7 w-56" />
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-40 shrink-0 sm:w-44">
            <Skeleton className={cx('aspect-square', round ? 'rounded-full' : 'rounded-xl')} />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
