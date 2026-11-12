// node render/preview.js <inDir> <out.jpg>   (CI preview job for test runs: one small contact sheet of everything that was rendered)
// One row per mp4 (found recursively, sorted by name): [frame 0][last frame][middle], i.e. frame 0 and the last frame sit side by side.
// Page loops (songNN.mp4, standby.mp4) get two more tiles: the frames either side of the first loop join at 22 s (2 s intro + 20 s period).
// They must look like consecutive frames of the same animation (same eq / blob state) = the loop is seamless. Row order and names: <out>.txt (no text rendering needed).
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const FFMPEG = process.env.FFMPEG || path.join(__dirname, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const TW = 480, TH = 270, GAP = 6, SEAM = 22;
const PAGE_LOOP = /^(song\d\d|standby)\.mp4$/;

// pure: seconds to sample for a clip of `dur` seconds
function times(name, dur) {
  const t = [0, Math.max(0, dur - 0.08), dur / 2];                    // start, end (the final frame is <= 2 frames away), middle
  if (PAGE_LOOP.test(name) && dur > SEAM + 1) t.push(SEAM - 0.05, SEAM - 0.01);   // pts >= 21.95 -> frame 659 (last of loop 1), >= 21.99 -> frame 660 (first of loop 2) at 30 fps
  return t;
}
const pos = (r, c) => ({ left: GAP + c * (TW + GAP), top: GAP + r * (TH + GAP) });
const duration = f => { const r = spawnSync(FFMPEG, ['-hide_banner', '-i', f], { encoding: 'utf8' }), m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr || ''); if (!m) throw new Error('no duration for ' + f); return +m[1] * 3600 + +m[2] * 60 + +m[3]; };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.mp4') ? [path.join(d, e.name)] : []);

module.exports = { times, pos };

if (require.main === module) (async () => {
  const [inDir, out] = process.argv.slice(2);
  if (!inDir || !out) { console.error('usage: node preview.js <inDir> <out.jpg>'); process.exit(2); }
  const files = fs.existsSync(inDir) ? walk(inDir).sort((a, b) => path.basename(a).localeCompare(path.basename(b))) : [];
  if (!files.length) { console.log('no mp4 files, no preview'); return; }
  const sharp = require('sharp'), tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'prev-')), comp = [], names = [];
  let cols = 3;
  files.forEach((f, r) => {
    const name = path.basename(f), t = times(name, duration(f)); cols = Math.max(cols, t.length); names.push(`row ${r + 1}: ${name}`);
    t.forEach((s, c) => {
      const jpg = path.join(tmp, `${r}_${c}.jpg`), x = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', s.toFixed(3), '-i', f, '-frames:v', '1', '-vf', `scale=${TW}:${TH}`, '-q:v', '3', jpg], { encoding: 'utf8' });
      if (x.status !== 0 || !fs.existsSync(jpg)) throw new Error(`frame ${s} of ${name} failed: ${x.stderr}`);
      comp.push({ input: jpg, ...pos(r, c) });
    });
  });
  await sharp({ create: { width: GAP + cols * (TW + GAP), height: GAP + files.length * (TH + GAP), channels: 3, background: '#111' } }).composite(comp).jpeg({ quality: 80 }).toFile(out);
  fs.writeFileSync(out.replace(/\.jpg$/, '') + '.txt', 'columns: frame 0 | last frame | middle | (page loops) frame before join | frame after join\n' + names.join('\n') + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${out}: ${files.length} clips, ${comp.length} frames`);
})().catch(e => { console.error(e); process.exit(1); });
