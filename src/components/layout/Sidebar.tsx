import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Heart, Home, Library, Plus } from 'lucide-react';
import { useLibrary } from '../../store/library';
import { useUI } from '../../store/ui';
import { usePlayer } from '../../store/player';
import GradientText from '../rb/GradientText';
import StarBorder from '../rb/StarBorder';
import { PlaylistCover } from '../overlays/Dialogs';
import { Artwork, Equalizer, cx } from '../ui/primitives';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass, end: false },
  { to: '/library', label: 'Library', icon: Library, end: false },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 shadow-[0_6px_24px_-6px_#ff3d6e]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px] fill-white" aria-hidden="true">
          <path d="M7 4.5v15l13-7.5z" />
        </svg>
      </span>
      <GradientText
        colors={['#ff3d6e', '#ff8a5c', '#7c5cff', '#38bdf8', '#ff3d6e']}
        animationSpeed={6}
        className="font-display text-[22px] font-bold tracking-tight"
      >
        Pulse
      </GradientText>
    </div>
  );
}

export function Sidebar() {
  const playlists = useLibrary((s) => s.playlists);
  const saved = useLibrary((s) => s.saved);
  const likes = useLibrary((s) => s.likes.length);
  const openCreate = useUI((s) => s.openCreatePlaylist);
  const sourceId = usePlayer((s) => s.source?.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const navigate = useNavigate();
  const savedLists = saved.filter((c) => c.kind !== 'artist');

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'group flex items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
      isActive ? 'bg-white/[0.09] text-ink' : 'text-ink-2 hover:bg-white/[0.05] hover:text-ink',
    );

  return (
    <aside className="glass-panel hidden w-[248px] shrink-0 flex-col overflow-hidden rounded-[26px] lg:flex">
      <div className="app-drag px-5 pt-5 pb-6">
        <button type="button" onClick={() => navigate('/')} aria-label="Pulse home">
          <Logo />
        </button>
      </div>
      <nav className="space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon className={cx('h-5 w-5 transition-colors', isActive && 'text-accent')} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-5 my-5 h-px bg-white/[0.07]" />

      <div className="px-4">
        <StarBorder
          onClick={() => openCreate()}
          className="w-full"
          color="var(--accent)"
          radius={14}
          duration={5}
          backgroundColor="rgba(255,255,255,0.06)"
          textColor="#f4f3f8"
          style={{ width: '100%' }}
        >
          <span className="flex items-center justify-center gap-2 py-0.5 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New playlist
          </span>
        </StarBorder>
      </div>

      <div className="no-scrollbar mt-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <NavLink to="/library/liked" className={linkClass}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2">
            <Heart className="h-4 w-4 fill-white text-white" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">Liked songs</span>
            <span className="block text-xs text-ink-3">{likes} songs</span>
          </span>
          {sourceId === 'liked' && <Equalizer playing={isPlaying} className="ml-auto" />}
        </NavLink>
        {playlists.map((p) => (
          <NavLink key={p.id} to={`/library/playlist/${p.id}`} className={linkClass}>
            <PlaylistCover tracks={p.tracks} className="h-10 w-10" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{p.name}</span>
              <span className="block text-xs text-ink-3">Playlist • {p.tracks.length}</span>
            </span>
            {sourceId === p.id && <Equalizer playing={isPlaying} className="ml-auto" />}
          </NavLink>
        ))}
        {savedLists.map((c) => (
          <NavLink key={`${c.kind}:${c.id}`} to={`/${c.kind}/${c.id}`} className={linkClass}>
            <Artwork src={c.thumbnail} className="h-10 w-10 shrink-0" rounded="md" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{c.title}</span>
              <span className="block truncate text-xs text-ink-3 capitalize">{c.kind}</span>
            </span>
            {sourceId === c.id && <Equalizer playing={isPlaying} className="ml-auto" />}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="glass flex rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cx('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors', isActive ? 'text-ink' : 'text-ink-3')
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cx('h-[22px] w-[22px]', isActive && 'text-accent')} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
