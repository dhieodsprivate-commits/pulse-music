/**
 * Cross-window player sync for the desktop mini player. Both windows share
 * the app origin, so a BroadcastChannel is all we need: the main window owns
 * playback and publishes state; the mini window renders it and sends commands.
 */
import type { Track } from './types';

export interface MiniState {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  liked: boolean;
  accent: string;
  colors: string[];
}

export type MiniCommand =
  | { cmd: 'hello' }
  | { cmd: 'toggle' }
  | { cmd: 'next' }
  | { cmd: 'prev' }
  | { cmd: 'like' }
  | { cmd: 'seek'; value: number }
  | { cmd: 'open-main' };

type Message = { type: 'state'; state: MiniState } | { type: 'command'; command: MiniCommand };

const CHANNEL = 'pulse-player';

export function openChannel(onMessage: (m: Message) => void) {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} };
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<Message>) => onMessage(e.data);
  return {
    post: (m: Message) => ch.postMessage(m),
    close: () => ch.close(),
  };
}
