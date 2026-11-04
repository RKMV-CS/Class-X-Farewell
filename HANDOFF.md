# NDPify handoff (state at 2026-11-02)

Read `README.md` and `CLAUDE.md` first. This file is what changed since, what is verified, and what to do next.

## Next task (do this first)
1. **Review each prototype scene in Chrome** (`prototype/index.html`, Space = next cue, `F` fullscreen). Go one clip at a time with the user and agree the look before rendering.
2. **Render each approved scene to MP4 with Remotion** (1920x1080, H.264, 30 fps, AAC, identical settings for every clip). Name files exactly as in `controller/cues.json` and put them in `controller/clips/`.
3. Finalize, then rehearse with the real laptop + projector.

### Clip rules (decided)
- Every clip starts and ends on the same idle frame so cuts are invisible.
- **Music ("now playing") and ad clips must be LONG: 15 to 20 minutes.** Long is free, short is the risk (a short loop ends visibly). Render them as one long seamless clip, not a short loop.
- No song title, progress bar or timer on Now Playing. Playlist rows show performers only.
- Animate with transform and opacity only (render is offline, but keep the look consistent with the prototype).

### Open decision for the user
`cues.json` modes today: `05_nowplaying_song1` and `09_nowplaying_song2` = `loop`; all others `hold`. The README says "Ad playing / Continuing ad" should also loop until the next cue, but `07_ad_video` and `08_continuing_after_ad` are `hold`. With 15-20 min clips it barely matters (the controller restarts a loop cue that reaches its end). Confirm which ad cues should be `loop`.

### Prototype cue to clip mapping (to reconcile)
| Prototype cue | Scene | Clip in `cues.json` |
|---|---|---|
| 1-2 Store, Install | Store page, install, fade to black | `01_store_download` |
| 3 Desktop and open | desktop, click icon, app opens | `02_ndpify_open` |
| 4 Home | trending + artists | `03_home_trending` |
| 5 Library | playlist slides in, opens | `04_library_playlist` |
| 6 Now playing | ambient loop | `05_nowplaying_song1` (15-20 min) |
| 7 Ad break | "Ads only for Pro", Get Pro | `06_adbreak_intro` |
| 8 Ad playing | continuing ad | `07_ad_video`, `08_continuing_after_ad` (15-20 min) |
| 9 Next song | now playing again | `09_nowplaying_song2` (15-20 min) |
| 10-11 | ad break + ad again | `10_extra_video_1`, `11_extra_video_2` (reconcile) |

`controller/clips/` currently holds **placeholder videos** (copies of sample mp4s from Downloads), not real clips. Replace all 11. The folder is gitignored.

## What was built this session (controller)
- `displays.js`: Windows display list + JPEG screenshot via PowerShell (about 1.5 s per capture).
- `launch.js`: run `node launch.js [--dry-run] [--windowed] [--screen N] [--port N] [--vlc-port N]`. Checks Node/VLC/express/clips, scans for free ports, detects displays, writes `start.generated.bat` and runs it in a new console (so the keyboard works). The bat starts VLC, records only its own VLC pid, runs `node server.js`, and kills only that pid on exit.
- `server.js` new routes: `GET /api/cues`, `/api/vlc`, `/api/displays`, `/api/screenshot.jpg[?screen=N]`, `POST /api/fullscreen`. Prints a **QR code** (`qrcode-terminal`, optional at runtime) for the phone URL.
- `controller.js` `tick()` (every 500 ms): restarts a `loop` cue that VLC parked at its end, unless the operator paused.
- `public/index.html`: operator dashboard (cue list with two-tap jump, NEXT/PREV/REPLAY/PAUSE, FULLSCREEN toggle, live projector preview, VLC state/time, "HELD AT END" label for a finished hold clip).
- Tests: `cd controller && npm test` = 7 passing.

## Findings on real VLC 3.0.24 (verified)
- `--play-and-pause` **overrides repeat**: a "loop" cue does not loop by itself, it parks paused at the end. Per-item `input-repeat` also loses. Fix = the `tick()` watcher above (restart via `seek val=0` + `pl_play`). Verified: wrapped 3x in 40 s staying `playing`.
- Hold cues freeze at the end (`paused`, time = length-1). Pause/resume works.
- **Port 8080 is held by an unrelated Windows service (`AgentService`).** Never use 8080 here; the launcher picks the next free port (8081). `start.bat`/`start.sh` default to 8080 and will fail on this laptop unless `VLC_PORT` is set.
- **White flash between clips (reported, random):** cause = `pl_empty` before each `in_play`. It stops playback, VLC tears down the video window, and every switch passed through a "stopped" state for 46-240 ms (one run also resized the window 1920x1080 -> 1936x1056 -> back). Fix applied: `playCue` no longer sends `pl_empty` (new item is appended and played; nothing is queued behind it), plus `--no-qt-video-autoresize` in `launch.js`, `start.sh`, `start.bat`. After the fix, 6 switches through the real controller showed one stable window size. A ~50 ms title refresh remains in the window log; it is probably only VLC's title text updating.
  - **Not proven gone on a real projector.** Only the window list was measured, not pixels. Watch for it in fullscreen on the real screen. If a blip remains, next ideas: run VLC with `--intf dummy --extraintf http` (no Qt window at all, so nothing white can show), or make clips' first/last frame identical dark.

## Not verified yet
- Fullscreen on a second display, and VLC's `--qt-fullscreen-screennumber` base (0 or 1). Only one display was available. User will connect a tablet via Spacedesk (Win+P = Extend), then run `node launch.js`, check the screen number with `/api/screenshot.jpg?screen=N`, and test the FULLSCREEN button.
- Dashboard and QR on a real phone (same Wi-Fi). The dashboard shows a no-auth warning: private network only.
- Audio output over HDMI, `start.bat`/`start.sh` (superseded by `launch.js`), hold last-frame look (frame vs black) on the projector.

## Run it
```
cd controller
npm install
node launch.js          # opens its own console window, prints the QR code
npm test
```
Dashboard: `http://localhost:3000` (port may change if busy; the launcher prints it). Stop: press `Q` in the controller console (its VLC is closed automatically).

## Safety notes for the next session
- Stop processes only by explicit PID and name check (a VLC and a node controller run on purpose; `AgentService` on 8080 is not ours).
- Do not take over the user's only monitor: with one display `launch.js` opens VLC windowed.
