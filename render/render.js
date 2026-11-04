// node render/render.js [clip-id ...]   (default: all approved clips in clips.js)
const fs = require('fs');
const path = require('path');
const { bundle } = require('@remotion/bundler');
const { selectComposition, renderMedia } = require('@remotion/renderer');
const { capture } = require('./capture');
const { approved, clips } = require('./clips');

const ROOT = __dirname, FRAMES = path.join(ROOT, 'frames');
const CLIPS_OUT = path.resolve(ROOT, '..', 'controller', 'clips');
const BACKUP = path.join(ROOT, 'backup-placeholders');
const cues = require('../controller/cues.json');

(async () => {
  const args = process.argv.slice(2), reuse = args.includes('--reuse'); // --reuse: skip capture, render existing frames/<clip>
  const rest = args.filter(a => a !== '--reuse'), ids = rest.length ? rest : approved;
  for (const id of ids) {
    if (!clips[id]) throw new Error(`unknown clip ${id}; known: ${Object.keys(clips)}`);
    const cue = cues.find(c => c.id === id);
    if (!cue) throw new Error(`${id} is not in controller/cues.json`);
    const t0 = Date.now();
    const def = clips[id];
    console.log(`[${id}] capturing frames...`);
    const cap = reuse ? { dir: path.join(FRAMES, id), frames: fs.readdirSync(path.join(FRAMES, id)).filter(f => f.endsWith('.png')).length } : await capture(id, def, FRAMES);
    cap.seconds = cap.frames / 30;
    const tCap = Date.now();
    let audio = null;
    if (def.sfx) def.audio = path.relative(ROOT, require('./audio').build(id, cap.frames / 30)); // synthesized UI sounds sized to the video
    if (def.audio) { audio = 'audio' + path.extname(def.audio); fs.copyFileSync(path.resolve(ROOT, def.audio), path.join(cap.dir, audio)); }
    console.log(`[${id}] ${cap.frames} frames (${cap.seconds.toFixed(2)} s), bundling + rendering...`);
    const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.jsx'), publicDir: cap.dir });
    const inputProps = { frames: cap.frames, audio };
    const comp = await selectComposition({ serveUrl, id: 'Clip', inputProps });
    const tmp = path.join(ROOT, 'out', id + '.mp4');
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    await renderMedia({
      composition: comp, serveUrl, inputProps, outputLocation: tmp,
      codec: 'h264', pixelFormat: 'yuv420p', crf: 12, colorSpace: 'bt709',
      imageFormat: 'png', audioCodec: 'aac', audioBitrate: '192k', enforceAudioTrack: true,
      concurrency: 4, onProgress: p => { if (p.renderedFrames % 100 === 0) process.stdout.write(`\r  ${p.renderedFrames}/${cap.frames}`); },
    });
    // publish only after a successful render; back up whatever was there (placeholder)
    const dest = path.join(CLIPS_OUT, cue.file);
    if (fs.existsSync(dest)) {
      fs.mkdirSync(BACKUP, { recursive: true });
      const b = path.join(BACKUP, cue.file);
      if (!fs.existsSync(b)) fs.copyFileSync(dest, b); // keep the ORIGINAL placeholder, never a previous render
    }
    try { fs.copyFileSync(tmp, dest); }
    catch (e) { // file locked (VLC has it open): never kill anything, write next to it
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e;
      const alt = dest.replace(/.mp4$/, '.new.mp4'); fs.copyFileSync(tmp, alt); console.log(`
[${id}] ${dest} is locked (${e.code}); wrote ${alt} instead`); continue;
    }
    console.log(`\n[${id}] -> ${dest}  capture ${((tCap - t0) / 1000).toFixed(0)} s, render ${((Date.now() - tCap) / 1000).toFixed(0)} s`);
  }
})().catch(e => { console.error(e); process.exit(1); });
