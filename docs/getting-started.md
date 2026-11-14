# Getting started (for students taking this over)

You will work with an AI coding assistant (**Claude Code** or **OpenAI Codex**). You do not need to understand every file. You need to know the idea, set up the tools, and give the assistant good instructions. The assistant reads [`AGENTS.md`](../AGENTS.md) automatically and follows its rules.

## 1. The idea in 5 lines

1. The show is a list of video clips (`controller/cues.json`).
2. The clips are made from one HTML page (`prototype/index.html`) by **GitHub's cloud machines**, not your laptop.
3. A small program (`controller/`) plays the clips in **VLC** when the operator presses NEXT.
4. Student videos come from Google Drive, processed by a GitHub workflow with a secret only the owner has.
5. Photos, videos and names are **private**. Never post them, never commit videos.

## 2. What to install

| Tool | Why | Check |
|---|---|---|
| [Git](https://git-scm.com/downloads) | get and change the code | `git --version` |
| [Node.js 22](https://nodejs.org) (18+ works for the controller) | run the controller and tests | `node --version` |
| [VLC](https://www.videolan.org/vlc/) | plays the clips | opens normally |
| [GitHub CLI `gh`](https://cli.github.com) | start cloud renders, download results | `gh --version`, then `gh auth login` |
| [Claude Code](https://claude.com/claude-code) **or** [Codex CLI](https://github.com/openai/codex) | your AI assistant | `claude --version` / `codex --version` |
| ffmpeg (optional) | only to make dummy practice clips | `ffmpeg -version` |

You also need **access to the GitHub repository** (ask the owner to add you as a collaborator) and, to download the finished clips, **access to the private clips repo** `codewithpom/ndpify-farewell` (also a collaborator invite) plus `gh auth login`. For new student videos the owner must run the workflow (the secret is theirs).

## 3. Get the code and check it works

```bash
git clone https://github.com/RKMV-CS/Class-X-Farewell.git
cd Class-X-Farewell
cd controller && npm ci && npm test      # expect: all tests pass
cd ..
```

Open `prototype/index.html` in Chrome, press `F` (fullscreen) and `Space` (next scene) to see the visuals.

**Download and go (finished show).** In the `controller` folder run `npm run setup` (or double-click `setup.bat` in the repo root on Windows). It installs the dependencies, downloads the 71 finished clips (8.4 GB, keep 10 GB free) from the private release, checks every file and every cue, and tells you when it is ready. If it stops, run it again: it continues where it stopped. Then `node launch.js`. `node setup.js --check` verifies the clips offline.

Practice the controller without real clips:

```bash
cd controller
./gen-dummy-clips.sh            # needs ffmpeg + bash (Git Bash on Windows)
node launch.js --dry-run        # check only
node launch.js                  # real start; dashboard http://localhost:3000
```

## 4. Start your assistant

Open a terminal **in the repo folder** and start the assistant:

```bash
claude        # Claude Code
# or
codex         # OpenAI Codex
```

First message to paste (it makes the assistant learn the project before touching anything):

> Read README.md, AGENTS.md, docs/technical-guide.md and docs/how-to.md. Then explain back to me in simple words how the show works, what runs on GitHub and what runs on my laptop, and what the hard rules are. Do not change any file yet.

## 5. Good prompts for common jobs

Copy, replace the `<...>` parts. The assistant knows the recipes in `docs/how-to.md`.

- **Change the order of the show**: "Move cue `<id>` to after cue `<id>` in controller/cues.json, keep the labels' row numbers correct, run the tests and the dry run, and tell me what to check."
- **Fix a photo's crop**: "In the Guess Who data for `<name>`, the Now photo cuts off the face. Download the latest `photo-contact-sheet` artifact if needed, adjust the object-position, then test-render only that round on GitHub (`gw-clips.yml` with `only=_gw<N>`), download the `preview` artifact and show me the picture."
- **Replace a student video**: "I have a new Drive link for `<video name>`. Tell me exactly which secret to update and which workflow to run. Do not write the link anywhere in the repo."
- **Add a kid**: "Add a new Guess Who kid following docs/how-to.md. Ask me for the photos and the position in the order."
- **Change the order of the show**, no coding: open the dashboard (`node launch.js`, then http://localhost:3000), press **Edit sequence**, drag the handle to reorder, use Rename / Remove / Add clip. Details in [show-day-guide.md](show-day-guide.md#7-changing-the-sequence-before-the-show).
- **Prepare for the show**: "Run the checklist from docs/show-day-guide.md that can be checked from code: tests, dry run, list any missing or unused clips."
- **Something looks wrong**: "Here is a screenshot / error. Find the cause before changing anything and explain it to me first."

## 6. How to work safely

- Work on a **branch** (`git checkout -b feature/<what-you-do>`), open a **pull request** into `main`. Do not push to `release` (that starts an hour-long render and publishes a public release).
- Heavy work (render, video, image conversion) goes to **GitHub Actions**: `gh workflow run ...`. Your laptop only edits files and downloads results.
- Before you say "done": tests pass, the dry run shows no missing clips, you looked at a preview picture if visuals changed.
- If the assistant wants to run something that deletes things, publishes, or touches secrets, read it first and ask the owner if you are unsure.
- Never paste student videos, Drive links to them, API keys or passwords into the chat with the assistant or into any file.

## 7. Where things are

| I want to... | Look in |
|---|---|
| change a scene's look, names, songs, Guess Who data | `prototype/index.html` (config at the top of the script) |
| change the show order / labels | `controller/cues.json` |
| change how clips are rendered | `render/` (and `.github/workflows/`) |
| change controller behaviour or the dashboard | `controller/` (`public/index.html` is the dashboard) |
| understand why something is done a certain way | [technical-guide.md](technical-guide.md) |
| run the show on the day | [show-day-guide.md](show-day-guide.md) |
