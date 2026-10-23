import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { Item, Track } from '../lib/types';
import { DEFAULT_PALETTE, type Palette } from '../lib/color';

export interface Toast {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export interface MenuState {
  item: Item;
  x: number;
  y: number;
  /** Extra actions for the specific surface (e.g. "Remove from queue"). */
  extra?: { label: string; icon?: ReactNode; danger?: boolean; onSelect: () => void }[];
}

/** Visual mood published by the current page (e.g. an album's artwork). */
export interface Scene {
  key: string;
  colors: string[];
  art?: string;
}

export type NowPlayingTab = 'upnext' | 'lyrics' | 'related';

interface UIState {
  toasts: Toast[];
  nowPlaying: boolean;
  nowPlayingTab: NowPlayingTab;
  menu: MenuState | null;
  addToPlaylist: Track[] | null;
  createPlaylist: { tracks: Track[] } | null;
  shortcuts: boolean;
  palette: Palette;
  /** Element the video player should overlay when video mode is visible. */
  videoSlot: HTMLElement | null;
  searchFocus: number;
  scene: Scene | null;

  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  openNowPlaying: (tab?: NowPlayingTab) => void;
  closeNowPlaying: () => void;
  setNowPlayingTab: (tab: NowPlayingTab) => void;
  openMenu: (m: MenuState) => void;
  closeMenu: () => void;
  openAddToPlaylist: (tracks: Track[]) => void;
  closeAddToPlaylist: () => void;
  openCreatePlaylist: (tracks?: Track[]) => void;
  closeCreatePlaylist: () => void;
  setShortcuts: (open: boolean) => void;
  setPalette: (p: Palette) => void;
  setVideoSlot: (el: HTMLElement | null) => void;
  focusSearch: () => void;
  setScene: (scene: Scene | null) => void;
  clearScene: (key: string) => void;
}

let nextId = 1;

export const useUI = create<UIState>()((set) => ({
  toasts: [],
  nowPlaying: false,
  nowPlayingTab: 'upnext',
  menu: null,
  addToPlaylist: null,
  createPlaylist: null,
  shortcuts: false,
  palette: DEFAULT_PALETTE,
  videoSlot: null,
  searchFocus: 0,
  scene: null,

  toast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: nextId++ }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openNowPlaying: (tab) => set((s) => ({ nowPlaying: true, nowPlayingTab: tab ?? s.nowPlayingTab, menu: null })),
  closeNowPlaying: () => set({ nowPlaying: false }),
  setNowPlayingTab: (tab) => set({ nowPlayingTab: tab }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  openAddToPlaylist: (tracks) => set({ addToPlaylist: tracks, menu: null }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),
  openCreatePlaylist: (tracks = []) => set({ createPlaylist: { tracks }, addToPlaylist: null, menu: null }),
  closeCreatePlaylist: () => set({ createPlaylist: null }),
  setShortcuts: (open) => set({ shortcuts: open }),
  setPalette: (palette) => set({ palette }),
  setVideoSlot: (videoSlot) => set({ videoSlot }),
  focusSearch: () => set((s) => ({ searchFocus: s.searchFocus + 1, nowPlaying: false })),
  setScene: (scene) => set({ scene }),
  clearScene: (key) => set((s) => (s.scene?.key === key ? { scene: null } : s)),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().toast(t);
