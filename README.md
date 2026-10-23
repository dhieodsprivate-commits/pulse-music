# Pulse

A glassy YouTube Music desktop app for Windows 11: React Bits UI, live recommendations, synced lyrics, and a translucent Acrylic window you can see your desktop through.

## Run it

| What | Command |
| --- | --- |
| Desktop app (glass window) | `npm run app` or double-click the **Pulse Music** shortcut |
| Desktop app with hot reload | `npm run app:dev` |
| In a normal browser | `npm run dev` → http://localhost:5173 |
| Create Desktop + Start menu shortcuts | `powershell -ExecutionPolicy Bypass -File scripts/install-shortcut.ps1` |

The desktop app builds itself automatically the first time and after any code change.

## Highlights

- **Your YouTube Music account**: click **Sign in** (top right) and enter the code at google.com/device. Home, radio and recommendations then come from your account, and likes and listens sync back so it keeps learning. If Google rejects device sign-in, use the cookie option in the same dialog.
- **Speed dial, Quick picks, Mixed for you, Listen again, Because you listened to…**: built from your listening, even without an account.
- **Lyrics that follow the song**: time-synced (LRCLIB), with a word-by-word highlight, click any line to jump there, and a per-song ±0.25s sync nudge.
- **Glass that reacts**: the window takes on the colors of the current song, and of each album, artist or playlist you open. Explore, Library and Search each have their own light. Pick Acrylic, Mica or Solid and set the transparency in ⚙ Settings.
- **Mini player**: an always-on-top glass card (⚙ Settings → Open mini player, or the player bar button).
- **Keyboard**: press `?` in the app for all shortcuts (Space, N/P, ←/→, L, M, S, R, +, F, Y, /).

## Privacy

- Your account credentials are stored only in `.auth/` in this folder; they're git-ignored and only ever sent to Google/YouTube.
- Your library, playlists and history live in the app's local storage.
- The local server only accepts state-changing requests from the app itself.

## Project layout

- `server/`: YouTube Music data (youtubei.js), lyrics, account auth, served as `/api` by a Vite plugin
- `src/`: the React app (`components/rb` holds the React Bits components)
- `electron/`: the desktop shell (window glass, mini player)
