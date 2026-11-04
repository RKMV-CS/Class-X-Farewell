// node render/render-full.js [--only=id,id] [--shard=I/N] [--join] [--list] [--out=file.mp4] [--music=track] [--keep-frames]
// --shard=I/N renders machine I's balanced share of N (CI); --join only concatenates segments already in out/full.
// One shareable MP4 of the whole show in review-hub order: blur idle -> store -> install -> open -> home -> library -> now playing ->
// ad break -> ad playing -> every Guess Who student (mystery, reveal, dismiss) -> next song. 1920x1080, 60 fps, H.264 high quality.
// Each segment is captured from a fresh page load (every prototype cue starts on the previous cue's last frame, same as the VLC clips),
// encoded on its own, then joined with `-c copy`. Needs the review server (http://localhost:4000) or NDPIFY_URL. Sound: UI effects (soundtrack.js) + optional --music bed.
process.env.NDPIFY_FPS = '60';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { capture, FPS } = require('./capture');

const args = process.argv.slice(2);
const opt = n => (args.find(a => a.startsWith('--' + n + '=')) || '').slice(n.length + 3);   // --out=file.mp4, --music=track.webm
const ROOT = __dirname, FR = path.join(ROOT, 'frames60'), SEG = path.join(ROOT, 'out', 'full'), OUT = path.resolve(ROOT, opt('out') || path.join('out', 'NDPify_full_1080p60.mp4'));
const FFMPEG = path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const CRF = process.env.FULL_CRF || '15', POOL = +process.env.FULL_POOL || 3;
const keep = args.includes('--keep-frames');
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const shard = (args.find(a => a.startsWith('--shard=')) || '').slice(8).split('/').map(Number), sharded = shard.length === 2 && shard[1] > 0;
const joinOnly = args.includes('--join');
const students = require('../controller/cues.json').filter(c => /_gw\d+_guess$/.test(c.id)).length;
const NEXT = 8 + 3 * students;   // cue index of "Next song" (after the Guess Who block)

const segs = [
  ['000_idle_blur',   { steps: [{ state: 'blur', hold: 2.5 }], tail: 0 }],
  ['001_store_open',  { steps: [{ state: 'reveal', hold: 3.5 }], tail: 0 }],
  ['002_install',     { steps: [{ cue: 1 }], tail: 0.6 }],
  // 003_open is the heaviest scene (785 frames, ~25% of all work): three slices of one capture, so it can run on three machines. Earlier frames are still stepped (not saved), so the slices join seamlessly; ids share the cue number 003 for soundtrack.js.
  ['003a_open',       { steps: [{ cue: 2 }], tail: 0.6, range: [0, 262] }],
  ['003b_open',       { steps: [{ cue: 2 }], tail: 0.6, range: [262, 524] }],
  ['003c_open',       { steps: [{ cue: 2 }], tail: 0.6, range: [524, Infinity] }],
  ['004_home',        { steps: [{ cue: 3 }], tail: 1.5 }],
  ['005_library',     { steps: [{ cue: 4 }], tail: 0.8 }],
  ['006_nowplaying',  { steps: [{ cue: 5, idle: 8 }], tail: 0 }],
  ['007_adbreak',     { steps: [{ cue: 6 }], tail: 0.8 }],
  ['008_adplaying',   { steps: [{ cue: 7, idle: 5 }], tail: 0 }],
];
for (let k = 0; k < students; k++) {
  const c = 8 + 3 * k, n = String(9 + 3 * k).padStart(3, '0');
  segs.push([`${n}_gw${k + 1}_mystery`, { steps: [{ cue: c }], tail: 0.6 }],
            [`${String(10 + 3 * k).padStart(3, '0')}_gw${k + 1}_reveal`, { steps: [{ cue: c + 1 }], tail: 2.2 }],
            [`${String(11 + 3 * k).padStart(3, '0')}_gw${k + 1}_dismiss`, { steps: [{ cue: c + 2 }], tail: 0.4 }]);
}
segs.push([`${String(9 + 3 * students).padStart(3, '0')}_nextsong`, { steps: [{ cue: NEXT, idle: 7 }], tail: 0 }]);

// Machine I of N gets a longest-first greedy share of ALL segments by measured render time (shard-weights.json, local seconds), so every machine computes the same split.
const W = require('./shard-weights.json');
function mine(list) {
  if (!sharded) return list;
  const load = Array(shard[1]).fill(0), own = new Set(), w = id => W[id] || 300;
  [...list].sort((a, b) => w(b[0]) - w(a[0]) || (a[0] < b[0] ? -1 : 1)).forEach(([id]) => { const j = load.indexOf(Math.min(...load)); load[j] += w(id); if (j === shard[0] - 1) own.add(id); });
  return list.filter(([id]) => own.has(id));
}
const run = (cmd, a) => { const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed:\n${(r.stderr || '').slice(-1500)}`); };
async function one([id, def]) {
  const t0 = Date.now(), mp4 = path.join(SEG, id + '.mp4');
  if (fs.existsSync(mp4) && !only.length) { console.log(`[${id}] exists, skipped (delete out/full/${id}.mp4 to redo)`); return; }
  const cap = await capture(id, def, FR);
  const tmp = mp4 + '.part.mp4';
  run(FFMPEG, ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(cap.dir, '%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-bf', '2', '-r', String(FPS),
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', tmp]);
  fs.renameSync(tmp, mp4);
  if (!keep) fs.rmSync(cap.dir, { recursive: true, force: true });
  console.log(`[${id}] ${cap.frames} frames (${(cap.frames / FPS).toFixed(1)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

(async () => {
  fs.mkdirSync(SEG, { recursive: true });
  const todo = joinOnly ? [] : mine(segs).filter(([id]) => !only.length || only.some(o => id.includes(o)));
  if (args.includes('--list')) { console.log(todo.map(s => s[0]).join(' ')); return; }
  const q = todo.slice(); let failed = 0;
  await Promise.all(Array.from({ length: Math.min(POOL, q.length) }, async () => { while (q.length) { const s = q.shift(); try { await one(s); } catch (e) { failed++; console.error(`[${s[0]}] FAILED: ${e.message}`); } } }));
  if (failed || only.length || sharded) { console.log(failed ? `${failed} segment(s) failed; not joining` : 'partial run; not joining'); process.exit(failed ? 1 : 0); }
  const missing = segs.filter(([id]) => !fs.existsSync(path.join(SEG, id + '.mp4'))).map(([id]) => id);
  if (missing.length) { console.error('cannot join, missing segments: ' + missing.join(', ')); process.exit(1); }
  const list = path.join(SEG, 'list.txt');
  fs.writeFileSync(list, segs.map(([id]) => `file '${path.join(SEG, id + '.mp4').replace(/\\/g, '/')}'`).join('\n') + '\n');
  const wav = require('./soundtrack').soundtrack(FFMPEG, segs.map(([id]) => [id, path.join(SEG, id + '.mp4')]), path.join(ROOT, 'out', 'soundtrack.wav'), { music: opt('music') || undefined });
  run(FFMPEG, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT]);
  console.log('done ->', OUT);
})().catch(e => { console.error(e); process.exit(1); });
