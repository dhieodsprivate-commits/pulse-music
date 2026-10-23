import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Disc3, MoreHorizontal, MonitorPlay, Music } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../../store/player';
import { useUI, type NowPlayingTab } from '../../store/ui';
import { useLibrary } from '../../store/library';
import { useTweenedColors } from '../../hooks/useAppEffects';
import { formatTime, sized } from '../../lib/format';
import Grainient from '../rb/Grainient';
import TiltedCard from '../rb/TiltedCard';
import DecryptedText from '../rb/DecryptedText';
import GooeyNav from '../rb/GooeyNav';
import ShinyText from '../rb/ShinyText';
import CircularText from '../rb/CircularText';
import Noise from '../rb/Noise';
import { ArtistLinks } from '../media/TrackRow';
import { IconButton, cx } from '../ui/primitives';
import { isDesktop } from '../../lib/desktop';
import { LikeButton, SeekBar, TransportControls, VolumeControl } from './controls';
import { LiveLyric, LyricsPanel, RelatedPanel, UpNextPanel } from './panels';

const TABS: { id: NowPlayingTab; label: string }[] = [
  { id: 'upnext', label: 'Up next' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'related', label: 'Related' },
];

function VideoSlot() {
  const ref = useRef<HTMLDivElement>(null);
  const setVideoSlot = useUI((s) => s.setVideoSlot);
  useEffect(() => {
    setVideoSlot(ref.current);
    return () => setVideoSlot(null);
  }, [setVideoSlot]);
  return <div ref={ref} className="aspect-video w-full rounded-2xl bg-black/60 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />;
}

function ArtBack() {
  const track = useCurrentTrack();
  const source = usePlayer((s) => s.source);
  const plays = useLibrary((s) => (track ? s.trackStats[track.id]?.count ?? 0 : 0));
  const liked = useLibrary((s) => (track ? s.likes.some((t) => t.id === track.id) : false));
  if (!track) return null;
  const rows: [string, string][] = [
    ['Artist', track.artists.map((a) => a.name).join(', ') || '—'],
    ['Album', track.album?.name ?? '—'],
    ['Length', track.duration ? formatTime(track.duration) : '—'],
    ['Your plays', String(plays)],
    ['Liked', liked ? 'Yes' : 'Not yet'],
    ['Playing from', source?.title ?? '—'],
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-between bg-[linear-gradient(160deg,var(--tint-1),var(--tint-deep))] p-6 sm:p-8">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-white/60 uppercase">Track details</p>
        <p className="mt-2 line-clamp-2 font-display text-2xl font-bold">{track.title}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-white/55">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-white/50">Tap to flip back</p>
    </div>
  );
}

export function NowPlaying() {
  const open = useUI((s) => s.nowPlaying);
  const track = useCurrentTrack();
  // Close automatically if the queue empties.
  useEffect(() => {
    if (open && !track) useUI.getState().closeNowPlaying();
  }, [open, track]);
  return <AnimatePresence>{open && track && <NowPlayingView key="np" />}</AnimatePresence>;
}

function NowPlayingView() {
  // Keep showing the last track while the exit animation runs after the queue empties.
  const live = useCurrentTrack();
  const lastTrack = useRef(live);
  if (live) lastTrack.current = live;
  const track = lastTrack.current!;
  const navigate = useNavigate();
  const close = useUI((s) => s.closeNowPlaying);
  const tab = useUI((s) => s.nowPlayingTab);
  const setTab = useUI((s) => s.setNowPlayingTab);
  const openMenu = useUI((s) => s.openMenu);
  const palette = useUI((s) => s.palette);
  const source = usePlayer((s) => s.source);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const settings = useLibrary((s) => s.settings);
  const setSetting = useLibrary((s) => s.setSetting);
  const colors = useTweenedColors(palette.colors);
  const panelRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const video = settings.videoMode;

  useEffect(() => setFlipped(false), [track.id]);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      // Follows the Transparency setting: at 100% only the window's own glass remains.
      style={{ background: 'rgb(7 7 11 / max(0, calc(1 - var(--see) * 1.2)))' }}
      initial={{ y: '100%', borderRadius: 32 }}
      animate={{ y: 0, borderRadius: 0 }}
      exit={{ y: '100%', borderRadius: 32 }}
      transition={{ type: 'spring', damping: 32, stiffness: 260, mass: 0.9 }}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      {/* Living background tinted by the artwork. */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: 'calc(1 - var(--see) * 0.9)' }}>
        {settings.motionBackgrounds ? (
          <Grainient
            colors={colors}
            speed={isPlaying ? 0.6 : 0.15}
            flow={0.9}
            scale={1.2}
            silk={0.5}
            grainAmount={0.05}
            saturation={1.1}
            interactive={false}
            clickSwirl={false}
            intro={false}
          />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(150deg, ${colors[0]}, ${colors[3] ?? colors[1]})` }} />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_30%_40%,rgba(0,0,0,0.25),rgba(0,0,0,0.78))]" />
        {settings.grain && <Noise opacity={0.05} fps={12} />}
      </div>

      <header
        className={cx(
          'app-drag relative z-10 flex items-center justify-between gap-4 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2 sm:px-8',
          isDesktop && 'sm:pr-[150px]',
        )}
      >
        <IconButton label="Close (Esc)" onClick={close} className="text-ink">
          <ChevronDown className="h-6 w-6" />
        </IconButton>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/60 uppercase">Playing from</p>
          <ShinyText
            text={source?.title ?? 'Your queue'}
            className="block truncate text-sm font-semibold"
            color="#e7e5ef"
            shineColor="#ffffff"
            speed={3.5}
          />
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden rounded-full bg-black/30 p-1 backdrop-blur sm:flex" role="radiogroup" aria-label="Song or video">
            {[
              { v: false, label: 'Song', icon: Music },
              { v: true, label: 'Video', icon: MonitorPlay },
            ].map(({ v, label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={video === v}
                onClick={() => setSetting('videoMode', v)}
                className={cx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  video === v ? 'bg-white text-black' : 'text-white/75 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <IconButton
            label="More"
            className="text-ink"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openMenu({ item: track, x: r.right, y: r.bottom });
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </IconButton>
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:overflow-hidden">
        {/* Left: artwork / video + controls */}
        <section className="flex min-h-0 flex-col items-center justify-center gap-6 px-6 pt-4 pb-8 sm:px-10 lg:pb-10">
          <div className="flex w-full max-w-[min(480px,46vh)] shrink items-center justify-center lg:max-w-[min(500px,calc(100vh-460px))]">
            {video ? (
              <VideoSlot />
            ) : (
              <div className="relative aspect-square w-full">
                <TiltedCard
                  key={track.id}
                  imageSrc={sized(track.thumbnail, 544)}
                  altText={`${track.title} artwork`}
                  containerWidth="100%"
                  containerHeight="100%"
                  imageWidth="100%"
                  imageHeight="100%"
                  rotateAmplitude={9}
                  scaleOnHover={1.03}
                  showTooltip={false}
                  radius={22}
                  glare={0.35}
                  shadow={0.7}
                  floating={isPlaying}
                  gyroscope={false}
                  flipped={flipped}
                  onFlip={setFlipped}
                  backContent={<ArtBack />}
                />
                {/* Spinning "now playing" seal tucked on the artwork's corner. */}
                <div
                  className={cx(
                    'pointer-events-none absolute -right-5 -bottom-5 z-10 hidden transition-opacity duration-700 sm:block',
                    isPlaying ? 'opacity-100' : 'opacity-40',
                  )}
                >
                  <div className="glass-chip grid h-[108px] w-[108px] place-items-center rounded-full">
                    <CircularText
                      text="NOW PLAYING • PULSE • "
                      size={100}
                      fontSize={11}
                      fontWeight={700}
                      letterSpacing={2}
                      spinDuration={22}
                      color="rgba(255,255,255,0.85)"
                    >
                      <Disc3 className={cx('h-7 w-7 text-accent', isPlaying && 'animate-[spin_4s_linear_infinite]')} />
                    </CircularText>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-[640px]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-display text-2xl leading-tight font-bold tracking-tight sm:text-[32px]" title={track.title}>
                  <DecryptedText
                    key={track.id}
                    text={track.title}
                    animateOn="view"
                    sequential
                    revealDirection="start"
                    speed={28}
                    useOriginalCharsOnly
                    parentClassName="line-clamp-2"
                    encryptedClassName="text-white/40"
                  />
                </h1>
                <p
                  className="mt-1 truncate text-base text-white/70"
                  onClickCapture={(e) => {
                    if ((e.target as HTMLElement).closest('a')) close();
                  }}
                >
                  <ArtistLinks track={track} className="[&_a]:text-white/70 [&_a:hover]:text-white" />
                  {track.album?.id && (
                    <>
                      {' • '}
                      <button type="button" onClick={() => go(`/album/${track.album!.id}`)} className="hover:text-white hover:underline">
                        {track.album.name}
                      </button>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 pt-1">
                <LikeButton size={26} />
              </div>
            </div>
            {tab !== 'lyrics' && <LiveLyric className="mb-3" />}
            <SeekBar big />
            <div className="mt-4 flex items-center justify-center">
              <TransportControls size="xl" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              <VolumeControl width={180} />
              <button
                type="button"
                onClick={() => setSetting('videoMode', !video)}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold sm:hidden"
              >
                {video ? <Disc3 className="h-3.5 w-3.5" /> : <MonitorPlay className="h-3.5 w-3.5" />}
                {video ? 'Song' : 'Video'}
              </button>
            </div>
          </div>
        </section>

        {/* Right: Up next / Lyrics / Related */}
        <section className="flex min-h-[70vh] flex-col border-white/10 px-3 pb-4 sm:px-6 lg:min-h-0 lg:border-l lg:bg-black/15 lg:backdrop-blur-sm">
          <div className="sticky top-0 z-10 flex justify-center py-3">
            <GooeyNav
              items={TABS.map((t) => ({ label: t.label }))}
              activeIndex={TABS.findIndex((t) => t.id === tab)}
              onChange={(i) => setTab(TABS[i].id)}
              size="sm"
              color="#ffffff"
              activeTextColor="#0b0b10"
            />
          </div>
          <div ref={panelRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-48px),transparent)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.25 }}
                className="pt-3"
              >
                {tab === 'upnext' && <UpNextPanel />}
                {tab === 'lyrics' && <LyricsPanel scrollRef={panelRef} />}
                {tab === 'related' && <RelatedPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
