/** Bridge to the Electron shell (undefined when running in a normal browser). */
export type GlassMaterial = 'acrylic' | 'mica' | 'none';

interface PulseBridge {
  isDesktop: true;
  platform: string;
  getMaterial: () => Promise<GlassMaterial>;
  setMaterial: (m: GlassMaterial) => Promise<GlassMaterial>;
  setTitleBar: (opts: { symbolColor?: string }) => Promise<void>;
  mini: (show?: boolean) => Promise<void>;
  focusMain: () => Promise<void>;
  /** Opens Google's sign-in in an isolated window; resolves once YouTube Music accepts it. */
  googleLogin: () => Promise<{ ok: boolean; error?: string; account?: { name: string; handle?: string; photo?: string } | null }>;
  googleLogout: () => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    pulse?: PulseBridge;
  }
}

export const desktop: PulseBridge | null = typeof window !== 'undefined' && window.pulse?.isDesktop ? window.pulse : null;
export const isDesktop = !!desktop;
