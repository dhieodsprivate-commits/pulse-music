import { useState } from 'react';
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Loader2 } from 'lucide-react';
import ElasticSlider from '../rb/ElasticSlider';
import PulseHeart from '../rb/PulseHeart';
import Magnet from '../rb/Magnet';
import { usePlayer, useCurrentTrack } from '../../store/player';
import { useLibrary } from '../../store/library';
import { formatTime } from '../../lib/format';
import { IconButton, cx } from '../ui/primitives';

/** Seek bar with drag-to-scrub; the player is only seeked on release. */
export function SeekBar({ className, showTimes = true, big = false }: { className?: string; showTimes?: boolean; big?: boolean }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const seek = usePlayer((s) => s.seek);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const [scrub, setScrub] = useState<number | null>(null);
  const max = Math.max(1, duration);
  const value = scrub ?? Math.min(currentTime, max);

  return (
    <div className={cx('flex w-full items-center gap-3', className)}>
      {showTimes && (
        <span className={cx('w-11 shrink-0 text-right tabular-nums text-ink-3', big ? 'text-sm' : 'text-xs')}>
          {formatTime(value)}
        </span>
      )}
      <div className="relative min-w-0 flex-1">
        {/* Buffered range, drawn under the slider's transparent-ish track. */}
        <div
          className="pointer-events-none absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-white/10 transition-[width] duration-500"
          style={{ width: `${Math.min(100, buffered * 100)}%` }}
        />
        <ElasticSlider
          value={value}
          maxValue={max}
          disabled={!hasTrack}
          onChange={(v) => setScrub(v)}
          onChangeEnd={(v) => {
            seek(v);
            setScrub(null);
          }}
          leftIcon={null}
          rightIcon={null}
          valuePosition="bubble"
          formatValue={(v) => formatTime(v)}
          thickness={big ? 5 : 4}
          activeThickness={big ? 10 : 8}
          maxStretch={24}
          restOpacity={1}
          thumb
          trackColor="rgba(255,255,255,0.12)"
          rangeColor="var(--accent)"
          thumbColor="#fff"
          ariaLabel="Seek"
          style={{ width: '100%' }}
        />
      </div>
      {showTimes && (
        <span className={cx('w-11 shrink-0 tabular-nums text-ink-3', big ? 'text-sm' : 'text-xs')}>{formatTime(duration)}</span>
      )}
    </div>
  );
}

export function VolumeControl({ className, width = 120 }: { className?: string; width?: number }) {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const shown = muted ? 0 : volume;
  const Icon = shown === 0 ? VolumeX : shown < 50 ? Volume1 : Volume2;
  return (
    <div className={cx('flex items-center gap-1', className)}>
      <IconButton label={muted ? 'Unmute (M)' : 'Mute (M)'} onClick={toggleMute} size="sm">
        <Icon className="h-[18px] w-[18px]" />
      </IconButton>
      <ElasticSlider
        value={shown}
        maxValue={100}
        onChange={setVolume}
        leftIcon={null}
        rightIcon={null}
        valuePosition="bubble"
        thickness={4}
        activeThickness={8}
        maxStretch={20}
        wheel
        restOpacity={1}
        trackColor="rgba(255,255,255,0.14)"
        rangeColor="#ffffff"
        ariaLabel="Volume"
        style={{ width }}
      />
    </div>
  );
}

export function PlayPauseButton({ size = 'md', magnetic = false }: { size?: 'sm' | 'md' | 'xl'; magnetic?: boolean }) {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const buffering = usePlayer((s) => s.buffering);
  const toggle = usePlayer((s) => s.toggle);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const dims = { sm: 'h-10 w-10', md: 'h-11 w-11', xl: 'h-[72px] w-[72px]' }[size];
  const icon = { sm: 'h-[18px] w-[18px]', md: 'h-5 w-5', xl: 'h-8 w-8' }[size];
  const btn = (
    <button
      type="button"
      onClick={toggle}
      disabled={!hasTrack}
      aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      title={isPlaying ? 'Pause' : 'Play'}
      className={cx(
        'relative grid place-items-center rounded-full bg-white text-black transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40',
        size === 'xl' && 'shadow-[0_10px_50px_-8px_var(--accent)]',
        dims,
      )}
    >
      {buffering && isPlaying ? (
        <Loader2 className={cx(icon, 'animate-spin')} />
      ) : isPlaying ? (
        <Pause className={cx(icon, 'fill-current')} />
      ) : (
        <Play className={cx(icon, 'ml-0.5 fill-current')} />
      )}
    </button>
  );
  if (!magnetic) return btn;
  return (
    <Magnet padding={60} magnetStrength={4} maxOffset={14}>
      {btn}
    </Magnet>
  );
}

export function TransportControls({ size = 'md', className }: { size?: 'md' | 'xl'; className?: string }) {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const big = size === 'xl';
  const ic = big ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;
  return (
    <div className={cx('flex items-center', big ? 'gap-5 sm:gap-7' : 'gap-2', className)}>
      <IconButton label={shuffle ? 'Shuffle on (S)' : 'Shuffle off (S)'} active={shuffle} onClick={toggleShuffle} size={big ? 'lg' : 'sm'}>
        <Shuffle className={ic} />
      </IconButton>
      <IconButton label="Previous (P)" onClick={prev} disabled={!hasTrack} size={big ? 'lg' : 'md'} className="text-ink">
        <SkipBack className={cx(ic, 'fill-current')} />
      </IconButton>
      <PlayPauseButton size={big ? 'xl' : 'md'} magnetic={big} />
      <IconButton label="Next (N)" onClick={next} disabled={!hasTrack} size={big ? 'lg' : 'md'} className="text-ink">
        <SkipForward className={cx(ic, 'fill-current')} />
      </IconButton>
      <IconButton
        label={repeat === 'off' ? 'Repeat off (R)' : repeat === 'all' ? 'Repeat all (R)' : 'Repeat one (R)'}
        active={repeat !== 'off'}
        onClick={cycleRepeat}
        size={big ? 'lg' : 'sm'}
      >
        <RepeatIcon className={ic} />
      </IconButton>
    </div>
  );
}

export function LikeButton({ size = 22 }: { size?: number }) {
  const track = useCurrentTrack();
  const liked = useLibrary((s) => (track ? s.likes.some((t) => t.id === track.id) : false));
  const toggleLike = useLibrary((s) => s.toggleLike);
  return (
    <PulseHeart
      liked={liked}
      onChange={() => track && toggleLike(track)}
      showCount={false}
      disabled={!track}
      size={size}
      corner={999}
      pillColor="transparent"
      idleColor="#a6a3b5"
      likedColor="var(--accent)"
      label={liked ? 'Remove from liked songs' : 'Like'}
    />
  );
}
