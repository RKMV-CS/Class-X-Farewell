# NDPify — school farewell show

A Spotify-style "NDPify" app (NDP = Narendrapur) that plays as a scripted visual show on a projector during a Class 10 farewell. Kids perform the songs live on stage; the screen only has to *look* like a music app that is playing, interrupted by a joke ad break (ads only play on the most expensive "Pro" plan, so the class had to buy it).

This folder is a hand-off: everything built so far, why it is built this way, what is verified, and what is next. **Latest state and the next task: see `HANDOFF.md`.**

```
ndpify/
├── README.md              <- you are here
├── CLAUDE.md              <- short context for Claude Code
├── prototype/
│   ├── index.html         <- browser prototype of every scene (single file, no deps)
│   └── README.md
└── controller/            <- Node + VLC cue controller for the real show
    ├── cues.json          <- ordered cue list (clip, hold/loop, label)
    ├── server.js          <- Express server, keyboard handler, phone-remote API
    ├── controller.js      <- debounce, logging, calls into VLC
    ├── cueState.js        <- pure cue state machine
    ├── vlc.js             <- VLC HTTP interface client
    ├── public/index.html  <- phone remote page
    ├── start.sh / start.bat
    ├── gen-dummy-clips.sh <- ffmpeg test clips (needs ffmpeg)
    ├── test/              <- unit tests + mock VLC
    └── README.md          <- setup, key map, stage-day checklist
```

## The problem and the chosen approach

- The school laptop is weak. OBS lags on it, so live-capturing a rendered UI is out.
- VLC plays video on the projector fine (it worked at this school before).
- Chosen approach: **pre-render the whole show as short video clips**, and let a small Node program act as a remote control for VLC. The operator presses a key (or a clicker, or a phone button) to move to the next cue.
- There is no single long video, so there is nothing to keep "in sync". The operator owns the timing of every cut. The kids sing live, so no clip may show a song title, progress bar or timer.
- The clip for "now playing" loops until the operator cuts to the next cue.

## Show flow (cue order)

| # | Scene | Notes |
|---|-------|-------|
| 1 | Microsoft-Store-style page with NDPify and an Install button | idle frame |
| 2 | Install clicked, download bar, "Installed", fade to black | |
| 3 | Desktop, cursor clicks the NDPify icon, app opens | ripple + zoom |
| 4 | Home: Trending songs (cards with artist names) and Popular artists (round photos) | clean, uncluttered |
| 5 | Library: playlist "Farewell Class X" slides in, cursor clicks it | playlist rows show performer names only, no song titles |
| 6 | Now playing | no title, no timer; blurred cover, glow, equalizer; loops until next cue |
| 7 | Ad break: "Ads only play for the top Pro plan", cursor clicks Get Pro, startup sting | |
| 8 | Ad playing, "Continuing ad" | loops until next cue |
| 9 | Next song (now playing again), then ad break again, and so on | |
| 10+ | Extra videos | |

The prototype follows this flow with 11 keyboard cues. The controller's `cues.json` has its own 11-cue list for clips (see below); the two are not 1:1 yet.

## Part 1 — Browser prototype (`prototype/index.html`)

Open the file in Chrome. No server, no install.

Keys: `Space` / `Right` next cue, `Left` replay the previous cue from its start, `1`-`7` jump to a scene, `F` fullscreen, `H` show/hide the cue indicator, `T` reveal the song title on Now Playing (off by default, on purpose).

Press any key once before the show so the browser allows the synthesized "Get Pro" sting.

Edit at the top of the `<script>`:
- `CONFIG`: school name, colours (saffron accent), copy for the ad break, plans, `media.adVideo` / `media.adPoster`, `playlist.hideTitles`, `home.artistCount`.
- `songs[]`: `title`, `artist`, `cover` (photo path), `gradient`. Titles are invented; replace them.
- `artists[]`: `name`, `role`, `cover`, `gradient`. Without a `cover`, gradient + initials show.

Placeholder names currently used: Piyush, Satyaki, Angan Mondal, Arnab Das, Ritwik Sen, Soumya Ghosh, Aditya Roy, Debojyoti Paul.

## Part 2 — VLC controller (`controller/`)

```bash
cd controller
npm install
./gen-dummy-clips.sh     # makes 11 test clips in clips/ (needs ffmpeg)
./start.sh [screen]      # launches VLC with its HTTP interface, then the Node server
npm test                 # 4 unit tests against a mock VLC
```

Windows: `start.bat [screen]`.

- Terminal keys: `Space` / `Right` / `PageDown` next, `Left` / `PageUp` previous, `R` replay, `P` pause/resume, `Q` quit, number keys jump to cues 1-9, `0` jumps to cue 10. Cue 11 via next, or `POST /api/jump/11`.
- Phone remote: the server prints a LAN URL (port 3000) with big Next / Prev / Replay / Pause buttons and the current and next cue. It has **no authentication**, so use only on a private network.
- A 300 ms debounce drops double presses so a cue cannot be skipped by accident.
- Cue modes: `hold` plays and freezes on the last frame, `loop` repeats until the next cue.
- Environment variables: `VLC_PASSWORD` (default `farewell`), `VLC_PORT` (8080), `PORT` (3000), `VLC_BIN`.

Full setup and the stage-day checklist are in `controller/README.md`.

## Status: what is verified and what is not

Verified in a sandbox:
- Prototype runs end to end in headless Chrome at 1920x1080 through all cues, with no console errors; Home, playlist and ad scenes were checked by screenshot after the latest edits; the ad scene keeps animating past 25 seconds.
- Controller: syntax checks, 4 unit tests (state machine, debounce, loop vs hold toggling, auth/URL format) against a mock VLC, phone-remote page and API served, error reported (not crash) when VLC is down.

**Not verified. Check these first:**
1. **Real VLC behaviour.** The HTTP commands (`in_play`, `pl_empty`, `pl_pause`, `pl_stop`, `pl_repeat`, `pl_loop`) were written from memory of the documented API. Check that `--play-and-pause` freezes cleanly on the last frame and that repeat loops without a visible flash.
2. **Projector screen number** for `--qt-fullscreen-screennumber` (0- or 1-based depending on the VLC build).
3. Terminal raw-mode keys and the phone remote page rendered on a real phone; `start.bat` was never run.
4. Prototype: sting audio, a real ad video file, real photos, smoothness on the weak laptop, browsers other than Chrome.

## Decisions worth keeping

- Pre-rendered clips driven by a cue list, not a live-rendered UI.
- Every clip should start and end on the same idle frame so cuts are invisible. The dummy clips only roughly do this.
- No progress bar or timer anywhere, because performance length is unknown.
- Song names are not revealed: hidden on Now Playing, and the playlist lists performers only.
- Transform/opacity animations only, for weak hardware.
- Stage-day safety: clips on local disk (not USB/network), disable sleep and notifications, test on the real laptop and projector, keep a backup laptop with the same files, rehearse with the kids and a cue sheet.

## Next steps

1. **Test the controller with real VLC** on the school laptop (or the closest Windows laptop) and fix command names or flags as needed.
2. **Turn the prototype into real clips.** Two options: rebuild the scenes in Remotion (React to MP4, 1080p, H.264, 30 fps, AAC, with sound effects baked in), or record the HTML prototype scene by scene (for example Playwright screen capture plus ffmpeg). Remotion gives cleaner motion; recording is faster. Render each scene as its own clip with matching idle first/last frames, and a 10+ minute seamless now-playing loop.
3. **Reconcile cue lists** between `prototype/index.html` and `controller/cues.json` so clip names match scenes.
4. **Dashboard** connected to VLC for the real show (the prototype loops placeholders; the real version should be driven from a dashboard). The phone remote is a starting point.
5. Real content: student photos, real artist names, real song list, the ad video, extra videos.
6. Full rehearsal with the kids and a cue sheet.

## Continue in Claude Code

Open Claude Code in this folder (`ndpify/`) and paste:

> Read README.md and CLAUDE.md. First, test the controller against real VLC and fix any command or flag problems. Then help me turn the prototype scenes into pre-rendered 1080p clips (Remotion or screen recording), matching the cue list in controller/cues.json. Keep the decisions in README.md.

## Branches and releases (GitHub Actions)

```
feature/<name>  --PR-->  main  --PR-->  release   (merge = new GitHub release with the full 1080p60 MP4)
```

- Work on a branch named after the feature, open a PR into `main`. CI runs the controller tests and a smoke render.
- When the show is ready to render, open a PR `main` -> `release`. Only `main` may be merged into `release` (CI enforces it).
- A push to `release` renders all segments on 2 Windows machines in parallel (`render/render-full.js --shard=I/N`), joins them (`--join`) and publishes `build-<run>` with the MP4 attached.
- Each render segment is a separate file in `render/out/full`, so a failed publish can be re-run without re-rendering.
- Test the pipeline without releasing: Actions -> Release render -> Run workflow, `only` = `000_idle_blur`.
