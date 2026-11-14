# Cue controller

Plays the pre-rendered clips in VLC in the order of `cues.json`. The operator advances with a keyboard / presentation clicker or the phone/laptop dashboard. Overview of the whole project: [../README.md](../README.md). Details: [../docs/technical-guide.md](../docs/technical-guide.md).

## Download and go (finished show)

```bash
cd controller
npm run setup        # npm ci + download the finished clips from the private release + verify (re-run any time)
node launch.js       # starts VLC + controller, dashboard at http://localhost:3000
```

Or double-click `setup.bat` in the repo root (does both). Needs Node 18+, VLC and the GitHub CLI `gh` logged in (`gh auth login`) with access to the private clips repo named in `clips.manifest.json`. Other commands:

- `node setup.js --check` verifies the clips folder without any network.
- `node setup.js --repair` re-downloads clips whose size differs from the release (it replaces files you changed on purpose).
- `node setup.js --write-manifest` rebuilds `clips.manifest.json` from your local `clips/` after you refreshed the clips (then upload them with `gh release upload <tag> <files> --clobber -R <source>` and commit the manifest).

Practice without the real clips: `./gen-dummy-clips.sh` (needs ffmpeg and bash).

## Run

`node launch.js [--screen N] [--windowed] [--dry-run]`. It checks Node, VLC, clips, free ports and screens, then opens VLC and the controller in their own console. `--dry-run` only checks. `start.sh` / `start.bat` are older launchers.

Environment variables: `VLC_PASSWORD` (default `farewell`), `VLC_PORT` (8080, launch.js picks a free one), `PORT` (3000), `VLC_BIN`, `CLIPS_DIR` and `CUES_FILE` (run a second instance on a copy without touching the real show).

The phone URL and a QR code are printed in the console. Phone and laptop must share a network. The remote has no password: private networks only. Nothing plays until the first NEXT.

## Keys (controller console window in front, or the dashboard)

| Key | Action |
|---|---|
| Space / Right / PageDown | next cue |
| Left / PageUp | previous cue |
| R | replay current cue |
| 1-9, 0 | jump to cue 1-9, 0 = cue 10 |
| P | pause / resume |
| Q or Ctrl+C | quit |

Commands within 300 ms of the last accepted one are ignored (double presses, key auto-repeat).

## Editing the sequence (dashboard, Edit sequence)

Turn on **Edit sequence** (off by default so show-day taps cannot change anything). Then: drag the handle (or use the arrows) to reorder, **Rename**, **Remove** (the video file stays in `clips/`), **Add clip or upload video** (unused videos in `clips/` or a new upload), **Undo** (last 20 changes). The playing cue cannot be removed and stays the current cue when you reorder. Every change is saved to `cues.json` at once; commit it to keep it, `git checkout controller/cues.json` returns to the shipped order. Do this before the show, not during it.

## cues.json

`id`, `file` (a plain file name under `clips/`), `mode` (`hold` = play then freeze on the last frame; `loop` = repeat until the next cue), `label`. Ids are unique. The dashboard writes this file.

## Tests

`npm test` (state machine, API, sequence editor, setup checks, launcher; mock VLC, no real VLC needed).
