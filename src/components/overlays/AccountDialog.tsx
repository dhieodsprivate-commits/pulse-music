import { useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useAccount } from '../../store/account';
import { isDesktop } from '../../lib/desktop';
import { Modal } from './Dialogs';
import { Artwork } from '../ui/primitives';
import ShinyText from '../rb/ShinyText';

function GoogleSignIn() {
  const busy = useAccount((s) => s.busy);
  const signIn = useAccount((s) => s.signInWithGoogle);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-center">
      <p className="text-sm text-ink-2">
        A small window opens with Google&apos;s own sign-in page. Sign in there once and Pulse connects to your YouTube Music.
      </p>
      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setError(await signIn());
        }}
        className="mt-6 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_40px_-10px_var(--accent)] transition hover:scale-105 active:scale-95 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
          </svg>
        )}
        {busy ? 'Finish signing in in the other window…' : 'Sign in with Google'}
      </button>
      {busy && (
        <p className="mt-4 text-xs text-ink-3">
          <ShinyText text="Waiting for YouTube Music…" color="#9a97ab" shineColor="#ffffff" speed={2.5} />
        </p>
      )}
      <p className="mt-6 flex items-start justify-center gap-2 text-left text-xs text-ink-3">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your password goes only to Google. Pulse keeps the session on this PC.
      </p>
    </div>
  );
}

function CookieSignIn() {
  const connectCookie = useAccount((s) => s.connectCookie);
  const busy = useAccount((s) => s.busy);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">
        Tip: the desktop app (<code className="rounded bg-white/10 px-1 text-xs">npm run app</code>) has one-click Google sign-in. In a browser,
        connect with your session cookie:
      </p>
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        <li>
          Open{' '}
          <a href="https://music.youtube.com" target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-white/30">
            music.youtube.com
          </a>{' '}
          and make sure you&apos;re signed in.
        </li>
        <li>
          Press <kbd className="rounded border border-white/15 px-1 text-xs">F12</kbd> → <b>Network</b> → refresh the page.
        </li>
        <li>
          Click any <b>music.youtube.com</b> request → <b>Headers</b> → copy the <b>cookie</b> request header.
        </li>
      </ol>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        spellCheck={false}
        placeholder="Paste the cookie value here"
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
      />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <p className="mt-2 flex items-start gap-2 text-xs text-ink-3">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Treat this like a password. It stays on this PC and is only sent to YouTube.
      </p>
      <button
        type="button"
        disabled={busy || value.trim().length < 20}
        onClick={async () => {
          setError(null);
          const err = await connectCookie(value);
          if (err) setError(err);
          else setValue('');
        }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Connect
      </button>
    </div>
  );
}

export function AccountDialog() {
  const open = useAccount((s) => s.dialog);
  const close = useAccount((s) => s.closeDialog);
  const status = useAccount((s) => s.status);
  const logout = useAccount((s) => s.logout);
  const account = status?.account;
  const active = status?.signedIn && !status.expired;

  return (
    <Modal open={open} onClose={close} title={active ? 'Your account' : 'Connect YouTube Music'}>
      <div className="px-6 pt-2 pb-6">
        {active ? (
          <div className="text-center">
            <Artwork src={account?.photo} className="mx-auto h-20 w-20 shadow-xl" rounded="full" />
            <p className="mt-3 font-display text-xl font-bold">{account?.name ?? 'Signed in'}</p>
            {account?.handle && <p className="text-sm text-ink-3">{account.handle}</p>}
            <p className="mx-auto mt-4 flex max-w-xs items-start gap-2 text-left text-sm text-ink-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              Home, radio and recommendations come from your YouTube Music account. Likes and listens sync back, so it keeps learning.
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="glass-chip mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-white/15"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <>
            {status?.expired && (
              <p className="mb-5 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Your YouTube Music session for {account?.name ?? 'your account'} expired. Sign in again to get your recommendations back.
              </p>
            )}
            {isDesktop ? <GoogleSignIn /> : <CookieSignIn />}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Avatar / "Sign in" button for the top bar. */
export function AccountButton() {
  const status = useAccount((s) => s.status);
  const openDialog = useAccount((s) => s.openDialog);
  if (status?.signedIn) {
    return (
      <button
        type="button"
        onClick={openDialog}
        aria-label="Account"
        title={status.expired ? 'Session expired — sign in again' : (status.account?.name ?? 'Account')}
        className="relative h-9 w-9 rounded-full ring-2 ring-white/15 transition hover:ring-white/40"
      >
        <Artwork src={status.account?.photo} className="h-full w-full" rounded="full" />
        {status.expired && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-base" />}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openDialog}
      className="glass-chip flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition hover:bg-white/15"
    >
      <KeyRound className="h-4 w-4" /> <span className="hidden md:inline">Sign in</span>
    </button>
  );
}
