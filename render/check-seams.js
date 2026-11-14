// node render/check-seams.js <clipsDir> [cues.json]   (needs ffmpeg on PATH)
// Cut quality between consecutive Guess Who clips: the last frame of clip N must match the first frame of clip N+1
// (guess -> reveal -> off -> next round's guess), and the first round must fade up from black. Prints mean abs luma diff per pair.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const W = 64, H = 36, SZ = W * H, MAX_DIFF = +process.env.SEAM_MAX || 8, MAX_BLACK = 20;

const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const gray = (file, pre) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', ...pre, '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0 || r.stdout.length < SZ) throw new Error(`ffmpeg failed on ${file}: ${String(r.stderr).slice(-200)}`);
  return r.stdout;
};
const first = f => gray(f, []).subarray(0, SZ), last = f => { const b = gray(f, ['-sseof', '-0.3']); return b.subarray(b.length - SZ); };

function selftest() {
  const a = require('assert');
  a.equal(diff([0, 10], [0, 10]), 0); a.equal(diff([0, 10], [10, 0]), 10); a.equal(mean([2, 4]), 3);
  console.log('check-seams selftest OK');
}
if (process.argv[2] === '--selftest') { selftest(); process.exit(0); }

const dir = process.argv[2], cuesF = process.argv[3] || path.join(__dirname, '..', 'controller', 'cues.json');
const cues = JSON.parse(fs.readFileSync(cuesF, 'utf8')).filter(c => /_gw\d+_(guess|reveal|off)$/.test(c.id));
let bad = 0;
const L0 = mean(first(path.join(dir, cues[0].file)));
console.log(`${cues[0].id}: first frame luma ${L0.toFixed(1)} (must fade from black, <= ${MAX_BLACK})`);
if (L0 > MAX_BLACK) bad++;
for (let i = 0; i + 1 < cues.length; i++) {
  const d = diff(last(path.join(dir, cues[i].file)), first(path.join(dir, cues[i + 1].file)));
  const ok = d <= MAX_DIFF; if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'JUMP'} ${cues[i].id} -> ${cues[i + 1].id}: ${d.toFixed(2)}`);
}
console.log(bad ? `${bad} seam problem(s)` : 'all Guess Who seams clean');
process.exit(bad ? 1 : 0);
