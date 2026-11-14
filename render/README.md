# NDPify render: prototype -> MP4 clips

These scripts turn `prototype/index.html` into the controller's clips. **They run on GitHub Actions, not on a laptop** (see the repo's [AGENTS.md](../AGENTS.md) rule 1 and [docs/technical-guide.md](../docs/technical-guide.md#render-pipeline)). Run them locally only if you really need to debug one.

| Script | Job |
|---|---|
| `capture.js` | Deterministic frame capture of the page in headless Chromium (virtual time, exact 1/60 s steps, 1920x1080). |
| `render-full.js` | Renders the show as segments (`--only=<substring>`, `--shard=I/N`, `--join`, `--list`). Segment names come from `controller/cues.json`. |
| `render-long.js`, `loops.js` | The 17-minute seamless loops (songs, standby, continuing ad). |
| `collect-clips.js` | Names the rendered segments as controller clips (`controllerName`), applies fades. |
| `check-seams.js` | Compares consecutive clips' edge frames and the black start of scene-entry clips. |
| `prep-photos.js` | Converts the Guess Who photos from Google Drive to `prototype/img/guesswho/*.jpg` and a contact sheet. |
| `preview.js`, `contact.js` | Preview sheets for review. |
| `shard-weights.json` | Work estimates used to balance shards across CI machines. |

Quality: 1920x1080, 60 fps, x264 `-preset veryslow -crf 10 -maxrate 60M -bufsize 120M`, yuv420p, bt709.

Self-tests (cheap, run anywhere): `node render/collect-clips.test.js`, `node render/prep-photos.js --selftest`, `node render/check-seams.js --selftest`.

`render.js`, `check.js` and `clips.js` are the original 30 fps prototype renderer and are kept for reference only; the show is rendered by `render-full.js` / `render-long.js`.
