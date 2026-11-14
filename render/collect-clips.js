// node render/collect-clips.js <segmentsDir> <loopsDir|-> <outDir> [cues.json]   (loopsDir '-' = Guess Who clips only: no scene clips, no loops)
// Release job: gathers the controller's clip set. Guess Who segments (render-full.js ids 009_gw1_mystery ...) get the controller names
// (12_gw1_guess, 13_gw1_reveal, 14_gw1_off, 15_gw2_guess ...) and the 17 min loop clips (render-long.js) are copied as they are.
// N (number of kids) = count of `*_gwK_guess` ids in cues.json; nothing else is read from it, so cues.json can change freely.
const fs = require('fs'), path = require('path');

const KIND = { mystery: ['guess', 0], reveal: ['reveal', 1], dismiss: ['off', 2] };   // segment kind -> [controller word, cue offset]
const GW = /^\d+_gw(\d+)_(mystery|reveal|dismiss)$/;

// '009_gw1_mystery' -> '12_gw1_guess'; c = 12 + 3 x (K - 1) for the guess cue, +1 reveal, +2 off. null for any other segment.
function controllerName(segId) {
  const m = GW.exec(segId); if (!m) return null;
  const k = +m[1], [word, off] = KIND[m[2]];
  return `${12 + 3 * (k - 1) + off}_gw${k}_${word}`;
}

// Scene segments (render-full.js ids 000_..., 002_...) -> controller clips. segs = 3-digit id prefixes joined in order (003a/b/c are slices of one cue);
// sfx = the clip has the audio.js sound design under its own id (else silent).
const SCENES = {
  '00_idle_blur':        { segs: ['000'] },
  '00_store_reveal':     { segs: ['001'] },
  '01_store_download':   { segs: ['002'], sfx: true },
  '02_ndpify_open':      { segs: ['003'], sfx: true },
  '03_home_trending':    { segs: ['004'], sfx: true },
  '04_library_playlist': { segs: ['005'], sfx: true },
  '06_adbreak_intro':    { segs: ['007'], sfx: true },
};
// Clips that start a new scene (the cue before them ends on an unrelated frame): they fade up from black so the cut is a dip, not a jump.
// Others start on the previous clip's last frame and must NOT fade. Song/standby loops get theirs in render-long.js.
const FADE_IN = new Set(['06_adbreak_intro', '12_gw1_guess']);
const FADE_S = 0.6;
// x264 re-encode with a fade-from-black head (the only place a clip is re-encoded; needs a full ffmpeg: the CI apt build has `fade`).
function fadeIn(ffmpeg, src, dst) {
  run(ffmpeg, ['-y', '-v', 'error', '-i', src, '-vf', `fade=t=in:st=0:d=${FADE_S}`, '-c:v', 'libx264', '-crf', '10', '-preset', 'veryslow', '-maxrate', '60M', '-bufsize', '120M', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', dst]);
}
const sceneParts = (files, sc) => files.filter((f) => sc.segs.includes(f.slice(0, 3))).sort();
const studentCount = cues => cues.filter(c => /_gw\d+_guess$/.test(c.id)).length;

// ids: segment ids found on disk. Returns { renames: [[segId, controllerName]], missing: [segId pattern], skipped: [segId] }
function plan(ids, n) {
  const renames = [], skipped = [], have = new Set();
  for (const id of ids) {
    const name = controllerName(id), k = name && +GW.exec(id)[1];
    if (name && k >= 1 && k <= n) { renames.push([id, name]); have.add(name); } else skipped.push(id);
  }
  const missing = [];
  for (let k = 1; k <= n; k++) for (const kind of Object.keys(KIND)) { const name = controllerName(`000_gw${k}_${kind}`); if (!have.has(name)) missing.push(name); }
  return { renames, missing, skipped };
}

module.exports = { controllerName, studentCount, plan, SCENES, sceneParts, FADE_IN };

// Joins each scene's segments (stream copy), adds its sound (or silence) and writes <outDir>/<clipId>.mp4. 60 fps like every other segment.
function buildScenes(segDir, outDir, ffmpeg, tmp) {
  const { spawnSync } = require('child_process');
  const { seconds } = require('./soundtrack'), { build } = require('./audio');
  const files = fs.readdirSync(segDir).filter((f) => f.endsWith('.mp4'));
  fs.mkdirSync(tmp, { recursive: true });
  for (const [id, sc] of Object.entries(SCENES)) {
    const parts = sceneParts(files, sc);
    if (!parts.length) throw new Error(`no segment with prefix ${sc.segs} for ${id}`);
    const list = path.join(tmp, id + '.txt');
    fs.writeFileSync(list, parts.map((f) => `file '${path.resolve(segDir, f).replace(/\\/g, '/')}'`).join('\n') + '\n');
    const joined = path.join(tmp, id + '.joined.mp4');
    run(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
    const dur = seconds(ffmpeg, joined);
    const audio = sc.sfx ? ['-i', build(id, dur, tmp)] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
    const out = path.join(outDir, id + '.mp4'), faded = FADE_IN.has(id), mux = faded ? path.join(tmp, id + '.mux.mp4') : out;
    run(ffmpeg, ['-y', '-v', 'error', '-i', joined, ...audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mux]);
    if (faded) fadeIn(ffmpeg, mux, out);
    console.log(`scene ${id}: ${parts.join(' + ')} (${dur.toFixed(1)} s${sc.sfx ? ', sound' : ', silent'}${faded ? ', fade-in' : ''})`);
  }
}
function run(cmd, a) {
  const r = require('child_process').spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed:
${(r.stderr || '').slice(-1500)}`);
}

if (require.main === module) {
  const [segDir, loopDir, outDir, cuesF = path.join(__dirname, '..', 'controller', 'cues.json')] = process.argv.slice(2);
  if (!segDir || !loopDir || !outDir) { console.error('usage: node collect-clips.js <segmentsDir> <loopsDir> <outDir> [cues.json]'); process.exit(2); }
  const mp4s = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.mp4')) : [];
  const cues = JSON.parse(fs.readFileSync(cuesF, 'utf8')), n = studentCount(cues), cueIds = new Set(cues.map(c => c.id));
  const { renames, missing, skipped } = plan(mp4s(segDir).map(f => f.slice(0, -4)), n);
  if (!n) { console.error(`no *_gwK_guess cue in ${cuesF}`); process.exit(1); }
  if (missing.length) { console.error(`missing Guess Who segments for ${n} kids: ${missing.join(', ')}`); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, name] of renames) { const src = path.join(segDir, id + '.mp4'), dst = path.join(outDir, name + '.mp4'); if (FADE_IN.has(name)) fadeIn(process.env.FFMPEG || 'ffmpeg', src, dst); else fs.copyFileSync(src, dst); if (!cueIds.has(name)) console.warn(`warning: ${name} is not a cue id in cues.json`); }
  const gwOnly = loopDir === '-';
  if (!gwOnly) { buildScenes(segDir, outDir, process.env.FFMPEG || 'ffmpeg', path.join(outDir, '.tmp')); fs.rmSync(path.join(outDir, '.tmp'), { recursive: true, force: true }); }
  const loops = gwOnly ? [] : mp4s(loopDir);
  for (const f of loops) fs.copyFileSync(path.join(loopDir, f), path.join(outDir, f));
  console.log(`${n} kids: ${renames.length} Guess Who clips renamed, ${loops.length} loop clips copied -> ${outDir}`);
  console.log(`loops: ${loops.join(' ')}\nnot copied (not controller clips): ${skipped.join(' ')}`);
}
