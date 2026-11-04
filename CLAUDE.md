# NDPify: context for Claude Code

School farewell show for Class 10, Narendrapur (NDP). Spotify-style "NDPify" visuals shown on a projector. See README.md for the full picture.

## Layout
- `prototype/index.html`: single-file browser prototype of every scene. Config at top of the script (`CONFIG`, `songs[]`, `artists[]`).
- `controller/`: Node + Express controller that drives VLC through its HTTP interface from a cue list (`cues.json`). Keyboard, clicker (PageUp/PageDown) and phone remote (port 3000).

## Rules for this project
- The show is **pre-rendered video clips played by VLC**, controlled by an operator. Do not move to live-rendering a UI on the stage laptop (it lags).
- Never show a song title, progress bar or timer on Now Playing. Kids sing live; timing is unknown. Playlist rows show performers, not song names (`playlist.hideTitles`).
- Every clip starts and ends on the same idle frame so cuts are invisible.
- Animate with transform and opacity only (weak hardware).
- Keep the controller dependency-light (Express, plus `qrcode-terminal` for the startup QR; it is optional at runtime), keep tests passing (`cd controller && npm test`).
- The phone remote has no auth; do not expose it beyond a private network.

## Known unverified
Real VLC command behaviour (`in_play`, `pl_empty`, `pl_pause`, `pl_stop`, `pl_repeat`, `pl_loop`), `--play-and-pause` last-frame freeze, loop flash, projector screen number base, `start.bat`. Test these first on real VLC.

## Commands
```bash
cd controller && npm install && ./gen-dummy-clips.sh && ./start.sh [screen]
cd controller && npm test
open prototype/index.html   # then F for fullscreen, Space for next cue
```
