# AGENTS.md — guide for AI coding agents (Codex, Claude Code, others)

You are working on **NDPify**: a pre-rendered, operator-driven projector show for a school farewell (Class X, Narendrapur). Read this file fully before editing anything. Humans: start at [README.md](README.md).

`CLAUDE.md` imports this file, so Claude Code and Codex read the same rules.

## 1. What the system is (30-second model)

```
prototype/index.html  --(CI: Playwright frame capture + ffmpeg)-->  MP4 clips  --(download)-->  controller/clips/
        ^ content lives here                                                                          |
                                                                                    controller (Node) drives VLC by cue list
                                                                                    operator: keyboard / clicker / phone dashboard
```

- The show is **~74 short pre-rendered video clips** played by **VLC** on the projector. A Node program (`controller/`) is a remote control: the operator presses NEXT, the controller tells VLC to play the next clip.
- Nothing is rendered live on the stage laptop (it is weak and lags). Never propose live rendering, OBS, or a browser-based show.
- Kids sing live. No clip may show a song title, progress bar or timer.
- The order of the show is **`controller/cues.json`**. The look of every scene is **`prototype/index.html`** (plus `prototype/stage/`).

## 2. Hard rules (do not break these)

1. **Heavy work runs on GitHub Actions, never on the laptop.** Rendering, ffmpeg encodes, image conversion/resizing, contact sheets, frame/luma checks, student-video processing = CI. Locally you may only: edit files, run git/gh, download CI artifacts, copy/delete clips, run `npm test`, run header-only `ffprobe`, start the controller.
2. **Student data is private client data.** Names, photos, videos, Drive links, the planning Google Sheet. Never put Drive file IDs of videos, API keys, tokens, passwords or emails into code, docs, commit messages, issues or PRs. Student videos are **never committed**; their Drive IDs live in the repo secret `STUDENT_VIDEO_IDS`. Never send student data to third-party services unless the owner asks.
3. **Never commit video.** `controller/clips/`, `render/out/`, `render/frames*/` and `*.mp4` scratch are gitignored. Keep it that way.
4. **Every clip starts and ends on a frame that matches its neighbour** so cuts are invisible. Scene-entry clips fade up from black. If you change a scene, run the seam check (`render/check-seams.js`, runs in the Guess Who workflow).
5. **Animate with `transform` and `opacity` only** in the prototype (consistent look, weak hardware).
6. **No song title / progress bar / timer on Now Playing.** Playlist rows list performers, not song names (`playlist.hideTitles`).
7. **The phone remote has no authentication.** Private network only; never expose port 3000 to the internet.
8. **Dependencies stay minimal.** Controller = Express + optional `qrcode-terminal`. Do not add a framework.
9. **Tests must pass**: `cd controller && npm test` (and `node render/collect-clips.test.js`, `node render/prep-photos.js --selftest`, `node render/check-seams.js --selftest`).
10. **Do not push to `release` unless the owner asks.** That starts a ~1 hour, 20-runner render and publishes a public release with the full video.
11. Stop processes only by explicit PID after checking the name. A VLC and a node controller run on purpose during the show; never `taskkill` by image name. Port **8080 is held by an unrelated Windows service on the dev laptop**; the launcher picks a free port instead.

## 3. Repo map

| Path | What it is |
|---|---|
| `prototype/index.html` | Single-file browser prototype of every scene. Config at the top of the `<script>`: `CONFIG`, `songs[]`, `artists[]`, `guessWho`. Cues array near the bottom (`cues`, `gwCue`, `NEXT_SONG`). |
| `prototype/stage/` | Standalone pages for the song loops and the standby screens (pure function of time, 20 s period). |
| `prototype/guesswho/` | Guess Who card component (`gw.js`, `GW.calcTiming` scales timer by number of "then" photos: 6/8/10 s). |
| `prototype/img/guesswho/` | Converted photos `<slug>_<slot>.jpg` and `sources.json` (Drive file ids of the photos). Originals/PNGs are gitignored. |
| `review/` | Review hub (`node review/server.js 4000`): serves the prototype on `http://localhost:4000/prototype/index.html`; CI and renders use it. |
| `render/` | Node render pipeline. `capture.js` (deterministic frame capture), `render-full.js` (segments, sharding, join), `render-long.js` + `loops.js` (17-minute seamless loops), `collect-clips.js` (segments -> controller clip names), `check-seams.js`, `prep-photos.js`, `preview.js`, `shard-weights.json`. |
| `controller/` | Express server + VLC driver. `cues.json` (order), `cueState.js` (pure state machine), `controller.js` (debounce, loop watcher), `vlc.js` (VLC HTTP client), `vlcProc.js`/`launch.js` (start VLC + server), `displays.js` (screens), `public/index.html` (operator dashboard), `test/`. |
| `.github/workflows/` | `ci.yml`, `release.yml`, `gw-clips.yml`, `prep-photos.yml`, `student-videos.yml` (see [docs/technical-guide.md](docs/technical-guide.md#ci-workflows)). |
| `docs/` | Human + LLM documentation. |

## 4. Contracts you must keep in sync

- **cues.json schema**: array of `{ id, file, mode: "hold" | "loop", label }`. `file` is under `controller/clips/`. `hold` = play then freeze on last frame. `loop` = repeat until the operator moves on (controller restarts it when VLC parks it at the end). Every `file` must exist in `controller/clips/`; every clip should be used.
- **Guess Who naming**: kid `k` (1-based, in `guessWho.students` order) has three cues with ids `${12 + 3*(k-1) + 0}_gw${k}_guess`, `${... + 1}_gw${k}_reveal`, `${... + 2}_gw${k}_off`. The file is `<id>.mp4`. `render/collect-clips.js:controllerName` builds these names from render segments `NNN_gwK_(mystery|reveal|dismiss)`.
- **Kid count** is derived from `cues.json` (count of `_gwK_guess` ids). `render-full.js` and `collect-clips.js` read it; the prototype reads `guessWho.students.length`. So `cues.json` and `guessWho.students` must have the same number of kids in the same order.
- **Photo files**: `prep-photos.js` `SLUGS` / `SLOTS` list allowed `slug` and `slot` values. `sources.json` entries `{id, file, slug, slot}` must use them. Output `<slug>_<slot>.jpg` must match the paths in `guessWho.students`.
- **Framing**: crops are done in CSS (`posT` per "then" photo, `posN`/`posNs` for "now"; `object-position` values), never by cropping files.
- **Student video clip names** (workflow matrix `out`, secret JSON keys, cue files): `v01_netflix_intro`, `v02_first_steps_jr`, `v03a_tour_class8`, `v03b_tour_class9`, `v03c_tour_class10`, `v04a_sr_edit`, `v04b_last_school`, `v05_finale`.
- **Quality settings** (keep identical across scripts): 1920x1080, 60 fps for rendered scenes, x264 `-preset veryslow -crf 10 -maxrate 60M -bufsize 120M`, yuv420p, bt709. Student videos keep native resolution/fps (31 fps source is conformed to 30).

## 5. Commands

```bash
# controller (runs anywhere with Node 18+; Node 22 in CI)
cd controller && npm ci && npm test
node launch.js --dry-run            # checks Node, VLC, express, clips, free ports, displays; starts nothing
node launch.js [--screen N] [--windowed]   # starts VLC + controller in its own console

# practice without real clips (needs ffmpeg + bash)
cd controller && ./gen-dummy-clips.sh

# render-side self-tests (no heavy work)
node render/collect-clips.test.js
node render/prep-photos.js --selftest
node render/check-seams.js --selftest

# run heavy jobs on CI
gh workflow run gw-clips.yml -f branch=<branch> -f only=_gw     # all Guess Who rounds, 12 runners
gh workflow run gw-clips.yml -f branch=<branch> -f only=_gw5    # test one round -> contact sheet artifact `preview`
gh workflow run prep-photos.yml -f branch=<branch>              # convert Drive photos -> jpgs, commits to branch
gh workflow run student-videos.yml                              # fade/re-encode the 8 student videos (needs secret)
gh run watch <run-id> ; gh run download <run-id> -n controller-clips-gw -D controller/clips
```

`workflow_dispatch` workflows only appear in `gh workflow run` if the workflow file exists **on the default branch (`main`)**. Merge workflow changes to `main` first (PR), then dispatch with `-f branch=<your branch>`.

## 6. Git flow

`feature/<name>` -> PR -> `main` -> PR -> `release` (only `main` may merge into `release`; CI enforces). `main` rejects direct pushes, so use PRs. Commit messages: short imperative subject, body only when the why is not obvious. Attribution lines as required by your tool. Update docs in the same PR as the behaviour change.

## 7. Task recipes

Step-by-step recipes live in [docs/how-to.md](docs/how-to.md): change a photo or its framing, add/remove a kid, reorder the show, replace a student video, re-render one round, refresh the clip set, prepare a release. Follow them; do not invent a different pipeline.

## 8. Definition of done for any change

1. `cd controller && npm test` passes; render self-tests pass.
2. If `cues.json` changed: `node launch.js --dry-run` (or a node one-liner) shows every cue's file exists and no clip is unused.
3. If visuals changed: a CI test render (`gw-clips.yml` with `only=`) produced a contact sheet you looked at (download the `preview` artifact and view it; zoom on faces for photo changes).
4. If clips changed: seam check green; first frame of scene-entry clips is black; student-video edge frames are black where a fade is expected.
5. Docs updated. No secrets, Drive ids of videos, or personal data added.
6. You state plainly what you did **not** verify (for example real VLC on the real projector).

## 9. Known unverified / traps

- Real VLC playback on the **actual venue laptop + projector** is not verified end to end: `--play-and-pause` last-frame look, loop flash, screen-number base (0-based on the test setup), audio over HDMI.
- VLC 3.x `--play-and-pause` overrides repeat; the controller's 500 ms `tick()` restarts loop cues. Do not "simplify" it away.
- `pl_empty` before `in_play` caused white flashes between clips; the controller no longer sends it. Do not reintroduce it.
- Google Drive returns a sign-in HTML page (not a video) for files that are not shared "anyone with the link"; CI steps detect this and fail with "not a video".
- A literal newline inside a `tr` argument in workflow YAML breaks the YAML (workflow loses `workflow_dispatch`). Use helper functions like the `avg()` in `student-videos.yml`.
- `render-full.js --only=` is a substring match on segment ids and is applied **before** sharding.
- Rendered artifacts expire (1-3 days). Rendered output is not in git; re-run the workflow to regenerate.
- `render/render-full.js` finds ffmpeg inside the Windows Remotion package, so the render jobs run on `windows-latest`; collect/seam/student jobs run on `ubuntu-latest` with `apt` ffmpeg (it has the `fade` filter the bundled one lacks).
