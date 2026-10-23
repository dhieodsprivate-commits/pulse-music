# Pulse

A glassy YouTube Music desktop app for Windows 11: React Bits UI, live recommendations, synced lyrics, and a see-through Acrylic window.

## Install

You need **Windows 10 or 11** (the see-through glass needs Windows 11), **[Node.js](https://nodejs.org) 22 or newer** and **[Git](https://git-scm.com)**.

Open a terminal (PowerShell) and run:

```
git clone https://github.com/dhieodsprivate-commits/pulse-music.git
cd pulse-music
npm install
npm run app
```

The first launch takes a few seconds while it builds itself. After that it opens straight away.

**Optional: Desktop and Start menu shortcuts** (so you don't need the terminal again):

```
powershell -ExecutionPolicy Bypass -File scripts/install-shortcut.ps1
```

Then just open **Pulse Music** like any other app.

## Use

- **Play music:** search at the top, or pick something on Home. Click the player bar at the bottom to open Now playing (lyrics, queue, related).
- **Sign in (optional):** click **Sign in** at the top right and log in on Google's own page. Home, radio and recommendations then come from your YouTube Music account. Without signing in, Pulse still recommends music from what you listen to.
- **Settings (⚙ gear icon):** window glass (Acrylic, Mica or Solid), transparency, film grain, animated backgrounds, showing the app behind Now playing, and the mini player.
- **Keyboard:** press `?` for all shortcuts. Space plays/pauses, N/P skip, ←/→ seek, `/` searches.

**Update to the latest version:** `git pull`, then `npm install`, then open the app as usual.

## Other ways to run

| What | Command |
| --- | --- |
| Desktop app | `npm run app` |
| Desktop app with hot reload (for development) | `npm run app:dev` |
| In a normal browser | `npm run dev` → http://localhost:5173 |

In a browser, sign in by pasting your music.youtube.com cookie (the Sign in dialog explains how).

## Features

- **Speed dial, Quick picks, Mixed for you, Listen again, Because you listened to…**: built from your listening, even without an account.
- **Lyrics that follow the song**: time-synced (LRCLIB), with a word-by-word highlight. Click any line to jump there, and nudge the sync ±0.25s per song.
- **Glass that reacts**: the window takes on the colours of the current song and of each album, artist or playlist you open.
- **Mini player**: an always-on-top glass card (⚙ Settings → Open mini player).

## Privacy

- Your sign-in session is stored only on your PC (in `.auth/` in this folder, which is never uploaded to git) and is only sent to Google/YouTube.
- Your library, playlists and history stay in the app's local storage.
- The local server only accepts state-changing requests from the app itself.

## Project layout

- `server/`: YouTube Music data (youtubei.js), lyrics and account sign-in, served as `/api` by a Vite plugin
- `src/`: the React app (`components/rb` holds the React Bits components)
- `electron/`: the desktop shell (window glass, mini player, Google sign-in window)
