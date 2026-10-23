import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Music2, RefreshCw } from 'lucide-react';

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

interface ArtworkProps {
  src?: string;
  alt?: string;
  className?: string;
  rounded?: 'md' | 'lg' | 'xl' | 'full';
  eager?: boolean;
}

/** A different CDN-cached size of the same Google image, for one retry. */
function alternateSrc(src: string): string | null {
  const m = /=w(\d+)-h\1(-p)?-l90-rj$/.exec(src);
  if (!m) return null;
  const next = Number(m[1]) > 226 ? 226 : 544;
  return src.replace(m[0], `=w${next}-h${next}${m[2] ?? ''}-l90-rj`);
}

/** Image with a soft fade-in, shimmer placeholder and graceful fallback. */
export function Artwork({ src, alt = '', className, rounded = 'lg', eager }: ArtworkProps) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Google's CDN occasionally answers 429 under load; retry once with another cached size.
  const [retry, setRetry] = useState<{ for: string; src: string } | null>(null);
  const radius = { md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-2xl', full: 'rounded-full' }[rounded];
  const current = retry && retry.for === src ? retry.src : src;
  const ok = current && failed !== current;
  return (
    <div className={cx('relative overflow-hidden bg-surface-3', radius, className)}>
      {ok ? (
        <img
          src={current}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(current)}
          onError={() => {
            const alt2 = src && retry?.for !== src ? alternateSrc(src) : null;
            if (src && alt2) setTimeout(() => setRetry({ for: src, src: alt2 }), 1200);
            else setFailed(current);
          }}
          className={cx(
            'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500',
            loaded === current ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-3 to-surface-2 text-ink-3">
          <Music2 className="h-1/3 w-1/3" strokeWidth={1.5} />
        </div>
      )}
      {ok && loaded !== current && <div className="skeleton absolute inset-0" />}
    </div>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, size = 'md', className, children, ...rest },
  ref,
) {
  const dims = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'relative inline-grid shrink-0 place-items-center rounded-full transition-[color,background-color,transform] duration-200 active:scale-90 disabled:pointer-events-none disabled:opacity-40',
        active ? 'text-accent' : 'text-ink-2 hover:text-ink',
        'hover:bg-white/8',
        dims,
        className,
      )}
      {...rest}
    >
      {children}
      {active && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
    </button>
  );
});

/** Animated equalizer bars shown on the playing row. */
export function Equalizer({ playing = true, className }: { playing?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex h-3.5 items-end gap-[2px]', className)} aria-label="Now playing">
      {[0, 0.25, 0.5, 0.15].map((d, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-accent"
          style={{
            height: '100%',
            animation: playing ? `eq ${0.8 + i * 0.12}s ease-in-out ${d}s infinite` : 'none',
            transform: playing ? undefined : 'scaleY(0.3)',
          }}
        />
      ))}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-lg', className)} />;
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-2xl">⚠️</div>
      <div>
        <p className="font-display text-xl font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm text-ink-3">{error.message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:scale-105 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function Pill({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95',
        active ? 'bg-white text-black shadow-[0_0_24px_-4px_var(--accent)]' : 'bg-white/[0.07] text-ink hover:bg-white/[0.13]',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {subtitle && <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">{subtitle}</p>}
        <h2 className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
