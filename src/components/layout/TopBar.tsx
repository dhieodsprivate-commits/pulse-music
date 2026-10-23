import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpLeft, ChevronLeft, ChevronRight, Clock, Keyboard, PictureInPicture2, Search, Settings2, X } from 'lucide-react';
import { api, q } from '../../lib/api';
import { useLibrary, type Settings } from '../../store/library';
import { useUI } from '../../store/ui';
import SquishSwitch from '../rb/SquishSwitch';
import ElasticSlider from '../rb/ElasticSlider';
import { Logo } from './Sidebar';
import { cx } from '../ui/primitives';
import { desktop, isDesktop } from '../../lib/desktop';
import { AccountButton } from '../overlays/AccountDialog';

function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const searches = useLibrary((s) => s.searches);
  const pushSearch = useLibrary((s) => s.pushSearch);
  const removeSearch = useLibrary((s) => s.removeSearch);
  const focusTick = useUI((s) => s.searchFocus);
  const urlQuery = location.pathname === '/search' ? new URLSearchParams(location.search).get('q') ?? '' : '';
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the box in sync when navigating between searches with back/forward.
  useEffect(() => setValue(urlQuery), [urlQuery]);

  useEffect(() => {
    if (focusTick) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusTick]);

  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      api<string[]>(`/suggest${q({ q: v })}`, { maxAgeMs: 30 * 60_000 })
        .then((s) => alive && setSuggestions(s))
        .catch(() => alive && setSuggestions([]));
    }, 140);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  const list = value.trim()
    ? suggestions.map((s) => ({ text: s, recent: searches.includes(s) }))
    : searches.slice(0, 8).map((s) => ({ text: s, recent: true }));

  useEffect(() => setActive(-1), [value, open]);

  const go = (text: string) => {
    const v = text.trim();
    if (!v) return;
    pushSearch(v);
    setValue(v);
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/search${q({ q: v })}`);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-[560px]">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(active >= 0 && list[active] ? list[active].text : value);
        }}
        className={cx(
          'flex h-11 items-center gap-2 rounded-xl border bg-white/[0.06] px-3 transition-all duration-200',
          open
            ? 'border-white/20 bg-[rgb(30_29_40/0.92)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_14%,transparent)]'
            : // Dark frosted fill stays readable over bright hero gradients.
              'border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl backdrop-saturate-150 hover:bg-black/40',
          open && list.length > 0 && 'rounded-b-none',
        )}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(list.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search songs, albums, artists, podcasts"
          aria-label="Search"
          aria-expanded={open}
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              inputRef.current?.focus();
            }}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-white/10 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <kbd className="hidden rounded-md border border-white/10 px-1.5 text-[11px] text-ink-3 sm:block">/</kbd>
      </form>

      <AnimatePresence>
        {open && list.length > 0 && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-xl border border-t-0 border-white/20 bg-[rgb(30_29_40/0.94)] py-1.5 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            {list.map((s, i) => (
              <li key={s.text} role="option" aria-selected={i === active}>
                <div
                  className={cx(
                    'group flex cursor-pointer items-center gap-3 px-3 py-2 text-[15px]',
                    i === active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]',
                  )}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(s.text)}
                >
                  {s.recent ? <Clock className="h-4 w-4 text-ink-3" /> : <Search className="h-4 w-4 text-ink-3" />}
                  <span className="flex-1 truncate">
                    <Highlight text={s.text} query={value} />
                  </span>
                  {s.recent ? (
                    <button
                      type="button"
                      aria-label={`Remove ${s.text} from history`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSearch(s.text);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Use ${s.text}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setValue(s.text + ' ');
                        inputRef.current?.focus();
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                    >
                      <ArrowUpLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const v = query.trim().toLowerCase();
  if (!v || !text.toLowerCase().startsWith(v)) return <span className="font-semibold">{text}</span>;
  return (
    <>
      <span className="text-ink-2">{text.slice(0, v.length)}</span>
      <span className="font-semibold">{text.slice(v.length)}</span>
    </>
  );
}

type ToggleKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const GLASS_STYLES: { id: Settings['glass']; label: string; hint: string }[] = [
  { id: 'acrylic', label: 'Acrylic', hint: 'Frosted — see your desktop through it' },
  { id: 'mica', label: 'Mica', hint: 'Soft wallpaper tint' },
  { id: 'solid', label: 'Solid', hint: 'No transparency' },
];

function GlassSettings() {
  const glass = useLibrary((s) => s.settings.glass);
  const transparency = useLibrary((s) => s.settings.transparency);
  const setSetting = useLibrary((s) => s.setSetting);
  if (!isDesktop) return null;
  return (
    <div className="px-3 pt-1 pb-2">
      <p className="pt-1 pb-2 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Window glass</p>
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/25 p-1" role="radiogroup" aria-label="Window glass style">
        {GLASS_STYLES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={glass === g.id}
            title={g.hint}
            onClick={() => setSetting('glass', g.id)}
            className={cx(
              'rounded-xl py-2 text-xs font-semibold transition',
              glass === g.id ? 'bg-white text-black shadow' : 'text-ink-2 hover:bg-white/10 hover:text-ink',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className={cx('mt-3 transition-opacity', glass === 'solid' && 'pointer-events-none opacity-40')}>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">Transparency</span>
          <span className="text-xs text-ink-3 tabular-nums">{Math.round(transparency * 100)}%</span>
        </div>
        <ElasticSlider
          value={Math.round(transparency * 100)}
          maxValue={100}
          onChange={(v) => setSetting('transparency', v / 100)}
          leftIcon={null}
          rightIcon={null}
          valuePosition="none"
          thickness={6}
          activeThickness={10}
          restOpacity={1}
          trackColor="rgba(255,255,255,0.14)"
          rangeColor="var(--accent)"
          ariaLabel="Transparency"
          style={{ width: '100%' }}
        />
      </div>
      <button
        type="button"
        onClick={() => void desktop?.mini()}
        className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm glass-chip hover:bg-white/[0.12]"
      >
        <PictureInPicture2 className="h-4 w-4 text-ink-2" /> Open mini player
      </button>
    </div>
  );
}

const SETTINGS: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'autoplay', label: 'Autoplay', hint: 'Keep playing similar music when the queue ends' },
  { key: 'motionBackgrounds', label: 'Animated backgrounds', hint: 'WebGL effects on Home and Now playing' },
  { key: 'sparks', label: 'Click sparks', hint: 'Little bursts when you click' },
  { key: 'grain', label: 'Film grain', hint: 'Subtle texture over the UI' },
  { key: 'videoMode', label: 'Prefer video', hint: 'Show the music video in Now playing' },
];

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const settings = useLibrary((s) => s.settings);
  const setSetting = useLibrary((s) => s.setSetting);
  const setShortcuts = useUI((s) => s.setShortcuts);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx('grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10', open && 'bg-white/10')}
      >
        <Settings2 className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass-strong no-drag absolute top-12 right-0 z-50 max-h-[calc(100vh-120px)] w-80 origin-top-right overflow-y-auto rounded-2xl p-2"
          >
            <GlassSettings />
            <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">Settings</p>
            {SETTINGS.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.05]">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-ink-3">{s.hint}</span>
                </span>
                <SquishSwitch
                  checked={settings[s.key]}
                  onChange={(v) => setSetting(s.key, v)}
                  width={40}
                  height={24}
                  trackOnColor="var(--accent)"
                  ariaLabel={s.label}
                />
              </label>
            ))}
            <div className="mx-3 my-1 h-px bg-white/[0.08]" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShortcuts(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
            >
              <Keyboard className="h-4 w-4 text-ink-2" /> Keyboard shortcuts
              <kbd className="ml-auto rounded-md border border-white/10 px-1.5 text-[11px] text-ink-3">?</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar({ scrolled }: { scrolled: boolean }) {
  const navigate = useNavigate();
  return (
    <header
      className={cx(
        'app-drag sticky top-0 z-30 flex h-16 items-center gap-3 px-4 transition-[background-color,backdrop-filter,border-color] duration-300 sm:px-8',
        isDesktop && 'sm:pr-[150px]',
        scrolled
          ? 'border-b border-white/[0.07] bg-[rgb(14_13_20/0.5)] shadow-[inset_0_-1px_0_rgb(255_255_255/0.03)] backdrop-blur-2xl backdrop-saturate-150'
          : 'border-b border-transparent',
      )}
    >
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="hidden items-center gap-1 lg:flex">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-ink-2 transition hover:text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Go forward"
          onClick={() => navigate(1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-black/30 text-ink-2 transition hover:text-ink"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
        <div className="hidden w-full justify-center sm:flex">
          <SearchBox />
        </div>
        <button
          type="button"
          aria-label="Search"
          onClick={() => navigate('/search')}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
      <AccountButton />
      <SettingsMenu />
    </header>
  );
}

/** Full-width search field used on small screens inside the search page. */
export function MobileSearch() {
  return (
    <div className="mb-6 sm:hidden">
      <SearchBox />
    </div>
  );
}
