# NDPify render: prototype cues -> MP4 clips

Pre-renders the approved scenes of `prototype/index.html` to `controller/clips/<name from cues.json>.mp4`.

1. `cd render && npm install` (once; Remotion + playwright-core, uses the installed Playwright Chromium).
2. Start the review server so `http://localhost:4000/prototype/index.html` answers (or set `NDPIFY_URL`).
3. `node render.js` renders every approved clip; `node render.js 02_ndpify_open` renders one.
4. `node check.js` prints ffprobe info, saves first/last frames in `out/check/` and diffs clip N last vs clip N+1 first.

How it works: `capture.js` runs the page in headless Chromium at 1920x1080 with CDP virtual time, steps exactly 1/30 s per frame
(rAF is flushed by the harness, Date/timers/CSS transitions follow virtual time), runs the cue(s) with `go()` until their `run()` promise resolves,
then holds `tail` seconds. Frames go to `frames/<clip>/%05d.jpg`. `src/Clip.jsx` plays them in Remotion; `render.js` encodes H.264 yuv420p crf 16 bt709,
30 fps, AAC 48 kHz stereo (silent unless `audio` is set) with identical settings for every clip, and copies the MP4 to `controller/clips/` only after success.
The previous file is saved once in `backup-placeholders/`.

Add a clip (04-11): approve the cue, then add one line to `clips.js`, e.g. `'04_library_playlist': { steps: [{ cue: 4 }], tail: 0.5 },`
and `node render.js 04_library_playlist`. `steps` are cue indexes in prototype order, `idle: s` idles that long instead of waiting for run(),
`audio: 'path.wav'` adds a soundtrack. Add the id to `approved` to include it in the default run. Do not edit the prototype for this.
