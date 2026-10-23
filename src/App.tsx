import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigationType, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap } from 'gsap';
import { useDesktopGlass, useDynamicTheme, useMediaSession, useShortcuts } from './hooks/useAppEffects';
import { useMiniHost } from './hooks/useMiniHost';
import { startAccountSync, useAccount } from './store/account';
import { AccountDialog } from './components/overlays/AccountDialog';
import { useLibrary } from './store/library';
import { useUI } from './store/ui';
import { mainScrollRef } from './lib/scroll';
import { Sidebar, MobileNav } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { PlayerBar, MiniPlayer } from './components/player/PlayerBar';
import { PlayerHost } from './components/player/PlayerHost';
import { NowPlaying } from './components/player/NowPlaying';
import { ContextMenu } from './components/overlays/ContextMenu';
import { AddToPlaylistDialog, CreatePlaylistDialog, ShortcutsDialog, Toaster } from './components/overlays/Dialogs';
import { ErrorState } from './components/ui/primitives';
import { Boundary } from './components/ui/Boundary';
import { toast } from './store/ui';
import { AmbientBackdrop } from './components/layout/AmbientBackdrop';
import ClickSpark from './components/rb/ClickSpark';
import GradualBlur from './components/rb/GradualBlur';
import Noise from './components/rb/Noise';
import NotFound from './pages/NotFound';
import Home from './pages/Home';
import Explore, { Mood } from './pages/Explore';
import Search from './pages/Search';
import Album from './pages/Album';
import Playlist from './pages/Playlist';
import Artist from './pages/Artist';
import Library, { LikedSongs, UserPlaylist } from './pages/Library';

gsap.registerPlugin(ScrollTrigger);

const scrollPositions = new Map<string, number>();

export default function App() {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const settings = useLibrary((s) => s.settings);
  const accent = useUI((s) => s.palette.accent);
  const nowPlayingOpen = useUI((s) => s.nowPlaying);

  useDynamicTheme();
  useDesktopGlass();
  useMiniHost();

  useEffect(() => {
    void useAccount.getState().refresh();
    return startAccountSync();
  }, []);
  useMediaSession();
  useShortcuts(() => {
    if (window.innerWidth < 640 && location.pathname !== '/search') navigate('/search');
    useUI.getState().focusSearch();
  });

  // Close transient UI when the route changes.
  useEffect(() => {
    const ui = useUI.getState();
    ui.closeMenu();
    ui.closeNowPlaying();
  }, [location.pathname]);

  // Scroll restoration for the custom scroll container.
  const lastKey = useRef(location.key);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    scrollPositions.set(lastKey.current, el.scrollTop);
    lastKey.current = location.key;
    const target = navType === 'POP' ? scrollPositions.get(location.key) ?? 0 : 0;
    el.scrollTop = target;
    // Content may still be streaming in; try once more after paint.
    if (target) requestAnimationFrame(() => (el.scrollTop = target));
  }, [location.key, navType]);

  // Keep ScrollTrigger in sync as async content changes page height.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => ScrollTrigger.refresh(), 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  return (
    <ClickSpark
      disabled={!settings.sparks}
      sparkColor={['#ffffff', accent]}
      sparkCount={9}
      sparkRadius={22}
      sparkSize={9}
      duration={420}
      className="h-full"
    >
      <AmbientBackdrop />
      {/* Fully hidden behind Now Playing so its glass only ever shows the desktop, not the app. */}
      <div
        className={`flex h-dvh flex-col transition-[opacity,visibility,transform] duration-300 lg:gap-2 lg:p-2 ${
          nowPlayingOpen ? 'invisible scale-[0.98] opacity-0' : 'visible scale-100 opacity-100'
        }`}
        aria-hidden={nowPlayingOpen || undefined}
      >
        <div className="flex min-h-0 flex-1 lg:gap-2">
          <Sidebar />
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:glass-panel lg:rounded-[26px]">
            <div
              id="snap-main-container"
              ref={(el) => {
                scrollRef.current = el;
                mainScrollRef.current = el;
              }}
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            >
              <TopBar scrolled={scrolled} />
              <main ref={contentRef} className="mx-auto w-full max-w-[1680px] px-4 pb-24 sm:px-8">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Boundary resetKey={location.pathname} fallback={(reset, error) => <ErrorState error={error} onRetry={reset} />}>
                    <Routes location={location}>
                      <Route path="/" element={<Home />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/mood/:name" element={<Mood />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/album/:id" element={<Album />} />
                      <Route path="/playlist/:id" element={<Playlist />} />
                      <Route path="/artist/:id" element={<Artist />} />
                      <Route path="/library" element={<Library />} />
                      <Route path="/library/liked" element={<LikedSongs />} />
                      <Route path="/library/playlist/:id" element={<UserPlaylist />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Boundary>
                </motion.div>
              </main>
            </div>
            <GradualBlur position="bottom" target="parent" height="4.5rem" strength={1.6} layers={5} curve="bezier" zIndex={20} />
          </div>
        </div>
        <Boundary>
          <MiniPlayer />
          <PlayerBar />
        </Boundary>
        <MobileNav />
      </div>

      {settings.grain && <Noise fixed opacity={0.035} fps={8} zIndex={45} />}
      <Boundary
        onError={() => {
          useUI.getState().closeNowPlaying();
          toast({ title: 'Now playing hit a snag', description: 'It was closed; playback continues.' });
        }}
        resetKey={nowPlayingOpen}
      >
        <NowPlaying />
      </Boundary>
      <PlayerHost />
      <Boundary onError={() => useUI.getState().closeMenu()}>
        <ContextMenu />
      </Boundary>
      <Boundary>
        <CreatePlaylistDialog />
        <AddToPlaylistDialog />
        <ShortcutsDialog />
        <AccountDialog />
        <Toaster />
      </Boundary>
    </ClickSpark>
  );
}
