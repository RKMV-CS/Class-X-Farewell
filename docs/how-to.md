# How-to recipes

Each recipe says what to edit and what runs on GitHub. Rule: **heavy work (render, video, images) runs on GitHub Actions**. Your laptop edits files, runs git/gh, downloads results. Workflow files must be on `main` to be started: `gh workflow run <file> --ref main -f branch=<your-branch>`.

## Check the setup
```bash
cd controller && npm test
node launch.js --dry-run     # Node, VLC, clips, ports, screens. Starts nothing.
```
Every file named in `cues.json` must exist in `controller/clips/`, and no clip should be unused.

## Reorder, add, remove or relabel the show
Easiest: the dashboard, **Edit sequence** (drag to reorder, Rename, Remove, Add clip or upload video, Undo; see [show-day-guide.md](show-day-guide.md#7-changing-the-sequence-before-the-show)). It saves to `controller/cues.json`; commit that file (via a PR) to keep the new order.
By hand: edit `controller/cues.json` (move entries, change `label`). No render needed. Keep row numbers at the start of labels matching the run-of-show sheet (the dashboard does not renumber labels). Then run the checks above.

## Switch a cue between hold and loop
Change `"mode"` in `cues.json` (or use the dashboard's mode toggle, which saves to `cues.json`). `hold` freezes on the last frame, `loop` repeats until NEXT.

## Change a Guess Who photo or its crop
1. New photo: share it on Drive ("anyone with the link"), update that entry's `id` in `prototype/img/guesswho/sources.json`.
2. `gh workflow run prep-photos.yml --ref main -f branch=<branch>`; it converts and commits the jpgs to your branch. Download artifact `photo-contact-sheet` and look at it.
3. Crop is CSS: edit `posT` / `posN` (`object-position`, for example `"50% 20%"`) for that kid in `guessWho.students` in `prototype/index.html`.
4. Test one round: `gh workflow run gw-clips.yml --ref main -f branch=<branch> -f only=_gw<N>`; download artifact `preview` and zoom on the face.
5. Render all: `-f only=_gw`, then `gh run download <run-id> -n controller-clips-gw -D controller/clips`.

## Add or remove a kid
1. Photos: add entries to `sources.json` (`slug`, `slot`: then1-then4, now, now1, now2) and add a new `slug` to `SLUGS` in `render/prep-photos.js`. Run `prep-photos.yml` (above).
2. Add or delete the kid in `guessWho.students` in `prototype/index.html`, at the right position.
3. In `cues.json`, give the kid three cues with ids `${12+3*(k-1)}_gw<k>_guess`, `+1 _reveal`, `+2 _off` (files `<id>.mp4`). **Every later kid's ids and the "x/N" in labels shift**, so renumber them. `cues.json` and `guessWho.students` must list the same kids in the same order.
4. Delete the old Guess Who clips (`12_gw*` onward) from `controller/clips/`, render all (`only=_gw`), download, run the dry run.

## Replace a student video
Videos are never committed. Their Drive ids are the repo secret `STUDENT_VIDEO_IDS` (JSON `{ "<clip name>": "<drive id>" }`, names listed in [technical-guide.md](technical-guide.md#student-videos-and-secrets)).
1. Upload the new video to Drive, share "anyone with the link", copy the id from the URL (`/d/<id>/`).
2. Owner: update the secret with the full JSON kept outside the repo: `gh secret set STUDENT_VIDEO_IDS < ids.json`.
3. `gh workflow run student-videos.yml --ref main`. It fades and re-encodes all 8.
4. `gh run download <run-id> -n student-clip-<clip name> -D controller/clips`.

## Refresh the clip set
- Guess Who only: `gw-clips.yml` (about 20 minutes, 12 machines) -> artifact `controller-clips-gw`.
- Everything else (scenes, songs, ads, standby): `release.yml`. A push to `release` renders all and publishes a **public** release plus artifact `controller-clips` (about an hour). Test one loop first with a manual run: `-f only=song03` (makes a `preview` sheet).
- Student videos: `student-videos.yml`.
Artifacts expire in 1-3 days, so download straight away.

**Keep the finished set downloadable.** The finished clips live in a release of the private repo named in `controller/clips.manifest.json` (so a student can run `npm run setup`). After you produce a new clip set:
1. Put the final files in `controller/clips/` and run the checks above.
2. Create a new release (or reuse the tag) and upload: `gh release create clips-<date> controller/clips/*.mp4 -R <source repo> --title "Finished clips" --notes "..."` (or `gh release upload <tag> <files> --clobber -R <source repo>`). Each file must be under 2 GiB.
3. `cd controller && node setup.js --write-manifest --source <owner/repo> --tag <tag>`, then commit `controller/clips.manifest.json` through a PR.
4. Check: `node setup.js --check` says every clip matches.

## Prepare for the show
Run the checks, copy `controller/clips/` to the laptop's local disk, rehearse on the real projector (see [show-day-guide.md](show-day-guide.md)), copy everything to the backup laptop.
