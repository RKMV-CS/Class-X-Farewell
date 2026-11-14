# NDPify — Class X farewell show

A Spotify-style "NDPify" app that plays on a projector as a scripted show while the class performs live on stage. Between songs there are joke ads, a "Guess Who" game (childhood photo vs today), student videos and a finale.

It is **not** a live app. The whole show is **pre-rendered 1080p60 video clips** played by **VLC**. A small Node program, the **controller**, is a remote control: the operator presses NEXT (keyboard, presentation clicker or phone) and the next clip plays. Nothing heavy runs on the stage laptop, so it cannot lag.

```
design in HTML  ->  GitHub renders clips (12-20 cloud machines)  ->  clips on the stage laptop  ->  operator presses NEXT  ->  VLC plays on the projector
prototype/          .github/workflows/ + render/                    controller/clips/             controller/                  
```

## Who should read what

| You are... | Read this |
|---|---|
| **Running the show on the day** (no coding) | [docs/show-day-guide.md](docs/show-day-guide.md) |
| **A student taking this over** (with Codex or Claude Code) | [docs/getting-started.md](docs/getting-started.md), then [docs/how-to.md](docs/how-to.md) |
| **A developer** who wants to understand or change it | [docs/technical-guide.md](docs/technical-guide.md) |
| **An AI coding agent** (Codex, Claude Code, Cursor, ...) | [AGENTS.md](AGENTS.md) (also imported by `CLAUDE.md`) |

## What is in the show

The order is the file [`controller/cues.json`](controller/cues.json): 74 cues. You can reorder, add, remove and rename cues in the operator dashboard (**Edit sequence**), no JSON editing needed. In short:

1. Welcome announcement (standby loop), then the Netflix-style intro and "MB27 Presents / The Final Chapter".
2. NDPify opens: blurred waiting screen, app store, install, desktop, home, library, playlist.
3. Songs (a calm "now playing" loop per song, kids sing live) with ad breaks between them. One ad is a live act (Act 1).
4. **Guess Who**: 14 kids, 3 presses each (mystery photo + timer, reveal, dismiss).
5. Student videos: "First Steps" + Junior section, three school tours, the farewell edit (two videos), the finale.
6. Closing announcement.

The operator controls every cut, so the timing of live performances never matters.

## Quick start: the finished show (download and go)

You need Node 18+ (22 recommended), VLC, and the GitHub CLI `gh` logged in (`gh auth login`) with access to the **private** clips repo `codewithpom/ndpify-farewell` (the show owner adds you as a collaborator). Then, on Windows, double-click **`setup.bat`**. Or by hand:

```bash
git clone <this repo>        # or the private copy: https://github.com/codewithpom/ndpify-farewell
cd <repo>/controller
npm run setup                # installs dependencies, downloads all 71 finished clips (8.4 GB), verifies them
node launch.js               # starts VLC + controller; dashboard at http://localhost:3000
```

Re-running `npm run setup` only fetches what is missing. `node setup.js --check` verifies the clips folder offline. Why are the clips not in the git repository? Every clip is bigger than git's 100 MB file limit and they hold the students' videos, so they live in a **private GitHub release** instead (see below).

## Quick start (practice, no real clips needed)

Needs Node 18+ (22 recommended), VLC, and for dummy clips ffmpeg + a bash shell (Git Bash on Windows).

```bash
git clone https://github.com/RKMV-CS/Class-X-Farewell.git
cd Class-X-Farewell/controller
npm ci
npm test                  # 28 tests, no VLC needed
./gen-dummy-clips.sh      # optional: placeholder clips so you can click through the controller
node launch.js --dry-run  # checks VLC, clips, ports, screens; starts nothing
node launch.js            # starts VLC + controller; dashboard at http://localhost:3000
```

To look at the visuals without any video: open `prototype/index.html` in Chrome, press `F` for fullscreen and `Space` for the next scene.

## The real clips are not in this repository

Videos are big and contain the students, so they are **never committed**. The finished set (71 clips, 8.4 GB) is stored as assets of the release `clips-2026-11-14` in the private repo named in `controller/clips.manifest.json`; `npm run setup` downloads and verifies it. New clips are produced on GitHub Actions and downloaded:

- Scene, song, ad and Guess Who clips: GitHub **Actions** workflows `Release render` and `Guess Who clips` (see [docs/how-to.md](docs/how-to.md#refresh-the-clip-set)).
- Student videos (the 8 videos made by the students): the workflow `Student videos (fades)` downloads them from Google Drive using a secret that only the repo owner has.

After a refresh, upload the new set to the private release and update the manifest (see [docs/how-to.md](docs/how-to.md#refresh-the-clip-set)). Download a workflow result with `gh run download <run-id> -n <artifact> -D controller/clips` (or from the run page), then run `node launch.js --dry-run` to confirm all 74 files are present.

## Repository layout

```
prototype/    the whole show as one HTML page (scenes, songs, Guess Who data) + photos
render/       Node scripts that turn the page into MP4 clips (run on GitHub, not on your laptop)
controller/   Node + VLC remote control, operator dashboard (with sequence editor), setup.js clip downloader, tests, cues.json
setup.bat     double-click: install + download clips + check + start the show software
review/       tiny server that hosts the prototype for the renderer and for reviewing
.github/      the cloud pipelines (CI, release render, Guess Who clips, photo prep, student videos)
docs/         guides for operators, students, developers
AGENTS.md     rules and map for AI coding agents
```

## Privacy

Student names, photos and videos are private. The repository holds converted Guess Who photos and names, so **share it only with the people who need it** (consider keeping it private and adding students as collaborators). Never commit videos, Google Drive links to videos, tokens or passwords. See [AGENTS.md](AGENTS.md#2-hard-rules-do-not-break-these).

## Branches

`feature/<name>` -> pull request -> `main` -> pull request -> `release`. Merging into `release` starts the full render (about an hour on 20 machines) and publishes a build. Details in [docs/technical-guide.md](docs/technical-guide.md#branches-and-releases).
