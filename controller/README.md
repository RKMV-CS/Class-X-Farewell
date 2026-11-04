# Farewell show cue controller

Plays pre-rendered clips in VLC in a fixed cue order. The operator advances with a keyboard / presentation clicker (terminal) or a phone browser.

## Setup
1. Install **VLC** (videolan.org), **Node.js 18+**, and **ffmpeg** (only needed for dummy clips).
2. `cd ndpify/controller && npm install`
3. Put real clips in `clips/` named as in `cues.json` (or run `./gen-dummy-clips.sh` for test clips).

## Run
- Linux/macOS: `./start.sh [screen]`  - Windows: `start.bat [screen]`
- `screen` selects the projector (`--qt-fullscreen-screennumber`). Numbering differs between VLC builds. Verified on the Windows test setup (main 1920x1080 + tablet 1280x800 as second monitor): it is **0-based**, so `1` = the second monitor, `0` = the primary, and an out-of-range number (e.g. `2`) silently falls back to the primary. Re-check on the real laptop + projector.
- Env vars: `VLC_PASSWORD` (default `farewell`), `VLC_PORT` (8080), `PORT` (3000), `VLC_BIN`.
- Node prints the phone URL (e.g. `http://192.168.x.x:3000`). Phone and laptop must be on the same Wi-Fi (or the phone hotspot). The remote has no auth: use a private network.
- Tests: `npm test` (state machine + mock VLC, no real VLC needed).
- The first "next" plays cue 1. Nothing plays until then.

## Keys (in the terminal running Node; keep that window focused)
| Key | Action |
|---|---|
| Space / Right / PageDown | next cue |
| Left / PageUp | previous cue |
| R | replay current cue |
| 1-9, 0 | jump to cue 1-9, 0 = cue 10 (cue 11 via phone `/api/jump/11` or next) |
| P | pause / resume |
| Q or Ctrl+C | quit |

Safety: commands within 300 ms of the last accepted one are ignored (covers double presses and key auto-repeat). Every transition and ignored press is logged. At the last cue "next" does nothing.

## cues.json
`id`, `file` (under `clips/`), `mode` (`hold` = play then freeze on last frame; `loop` = repeat until next cue), `label`.
How it maps to VLC: VLC is launched with `--play-and-pause` (freezes on last frame at end of item). `loop` cues additionally turn VLC's "repeat current item" on; `hold` cues make sure it is off.

## Clip guidance
Real clips should **start and end on the same idle frame** so that cuts between clips, holds and loops look seamless. Use identical resolution/fps/codec for all clips (H.264 MP4, 1920x1080, same fps). The dummy clips only approximate this (flat colour background, text at both ends).

## VLC HTTP commands used (verify!)
Written from memory of VLC's documented `requests/status.json` API; not verified against a real VLC here:
`in_play&input=<file:// URL>`, `pl_empty`, `pl_pause` (toggle), `pl_stop`, `pl_repeat` (toggle repeat-current; state in `repeat`), `pl_loop` (toggle playlist loop; state in `loop`). Auth is HTTP Basic with empty username and the `--http-password`. Because the toggles are toggles, the code reads `status.json` first and only toggles on mismatch.
Uncertain points to test on the real VLC version: whether `--play-and-pause` holds the last frame cleanly (some versions show black); whether repeat + play-and-pause loops without a flash; macOS/Windows VLC 4 builds may differ. Verified on the Windows test setup: the `in_play` cue flow works end to end and the screen number is 0-based (see Run). Fallback if hold shows black: append the last frame as a ~10 s still at the end of each clip, or add `option=input-repeat` handling.

## Stage-day checklist
- [ ] All clips on the laptop's **local disk** (not USB/network/cloud-synced folder).
- [ ] Disable sleep, screen saver, notifications, auto-updates; plug into power.
- [ ] Test on the **real laptop + projector** (resolution, screen number, audio output via HDMI) with the real clips.
- [ ] Run the full cue flow end-to-end once, including loop cues and the phone remote on the venue Wi-Fi.
- [ ] Check clicker sends PageDown/PageUp (or Right/Left) into the terminal window; keep that terminal focused.
- [ ] Set volume; check audio levels in the hall.
- [ ] **Backup laptop** with identical folder, clips and VLC, tested, on stage or ready; USB copy of clips.
- [ ] Printed cue list; know how to jump (number keys) if something goes wrong.
