// node render/render-long.js [np1 ad standby song02 .. song11] [--force] [--no-publish]   -> 17 min clips in render/out/long, copied to controller/clips (see loops.js)
// --no-publish (CI): leave the clips in render/out/long, do not touch controller/clips.
// Capture ONE seamless loop period (+ entry transition), encode intro/loop/tail separately with Remotion, join with `ffmpeg -c copy`.
const fs = require('fs'), path = require('path'), http = require('http');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const { bundle } = require('@remotion/bundler');
const { selectComposition, renderMedia } = require('@remotion/renderer');
const L = require('./loops');

const FPS = 30, ROOT = __dirname, PROJECT = path.resolve(ROOT, '..');
const FRAMES = path.join(ROOT, 'frames'), OUT = path.join(ROOT, 'out', 'long'), BACKUP = path.join(ROOT, 'backup-placeholders');
const CLIPS = path.join(PROJECT, 'controller', 'clips');
const FFMPEG = path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe'); // = `npx remotion ffmpeg`
const args = process.argv.slice(2), force = args.includes('--force'), noPublish = args.includes('--no-publish');
const keys = args.filter(a => !a.startsWith('--')), want = k => !keys.length || keys.includes(k);
const pad = n => String(n).padStart(5, '0');
fs.mkdirSync(OUT, { recursive: true });

// ---- static server (project root) + patched prototype copy ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const serve = () => new Promise(res => {
  const s = http.createServer((req, rsp) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.join(PROJECT, u);
    if (!f.startsWith(PROJECT)) { rsp.writeHead(403); return rsp.end(); }
    if (u === '/prototype/loops.html') {
      const html = fs.readFileSync(path.join(PROJECT, 'prototype', 'index.html'), 'utf8').replace('</body>', () => L.PAGE_PATCH + '</body>');
      rsp.writeHead(200, { 'content-type': 'text/html' }); return rsp.end(html);
    }
    fs.readFile(f, (e, b) => {
      if (e) { console.error('[404]', u); rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); rsp.end(b);
    });
  }).listen(0, '127.0.0.1', () => res(s));
});
// capture.js reads NDPIFY_URL once at require time: load a private copy per URL
const loadCapture = url => { process.env.NDPIFY_URL = url; delete require.cache[require.resolve('./capture')]; return require('./capture').capture; };

// ---- helpers ----
const raw = async (dir, i) => sharp(path.join(dir, pad(i + 1) + '.png')).removeAlpha().raw().toBuffer(); // i: 0-based frame
const diff = (a, b) => { let s = 0, mx = 0; for (let k = 0; k < a.length; k++) { const d = Math.abs(a[k] - b[k]); s += d; if (d > mx) mx = d; } return { mean: +(s / a.length).toFixed(4), max: mx }; };
function ff(argv) {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...argv], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + (r.stderr || r.error));
}
function publish(src, file) {
  if (noPublish) return src;
  const dest = path.join(CLIPS, file);
  if (fs.existsSync(dest)) { fs.mkdirSync(BACKUP, { recursive: true }); const b = path.join(BACKUP, file); if (!fs.existsSync(b)) fs.copyFileSync(dest, b); } // keep the ORIGINAL placeholder only
  const part = dest + '.part';
  try { fs.copyFileSync(src, part); fs.renameSync(part, dest); return dest; }
  catch (e) { // locked by VLC: never kill anything, write next to it
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e;
    try { fs.rmSync(part, { force: true }); } catch {}
    const alt = dest.replace(/\.mp4$/, '.new.mp4'); fs.copyFileSync(src, alt); console.log(`LOCKED ${dest} (${e.code}); wrote ${alt}`); return alt;
  }
}
let renderLock = Promise.resolve();
const render = (...a) => { const p = renderLock.then(() => renderNow(...a)); renderLock = p.catch(() => {}); return p; };
async function renderNow(dir, N, audio, jobs) { // jobs: [{ out, range?: [first, last] }] (0-based, inclusive) over the frames in `dir`
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.jsx'), publicDir: dir });
  const inputProps = { frames: N, audio };
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps });
  for (const j of jobs) {
    if (!force && fs.existsSync(j.out)) continue;
    const tmp = j.out + '.tmp.mp4';
    await renderMedia({
      composition, serveUrl, inputProps, outputLocation: tmp, codec: 'h264', pixelFormat: 'yuv420p', crf: 16, colorSpace: 'bt709', imageFormat: 'png', // same as render.js
      ...(audio ? { audioCodec: 'aac', audioBitrate: '192k', enforceAudioTrack: true } : { muted: true }), ...(j.range ? { frameRange: j.range } : {}),
      concurrency: 3, onProgress: p => { if (p.renderedFrames % 300 === 0) process.stdout.write(`\r  ${path.basename(j.out)} ${p.renderedFrames}`); },
    });
    fs.renameSync(tmp, j.out); console.log(`\n  rendered ${path.basename(j.out)}`);
  }
}

// ---- long loop clip ----
async function longClip(key, def, capture) {
  const t0 = Date.now(), id = 'L_' + key, dir = path.join(FRAMES, id), metaF = path.join(dir, 'meta.json');
  const settle = L.SETTLE_S * FPS, pf = def.period * FPS, tailF = settle + pf + 1; // +1: frame at I+pf must equal frame I
  let m;
  if (!force && fs.existsSync(metaF)) m = JSON.parse(fs.readFileSync(metaF, 'utf8'));
  else {
    console.log(`[${key}] capturing (${def.page ? 'page ' + def.page : 'cue ' + def.cue}, loop ${def.period}s)...`);
    // page loops: hold the idle page for settle + one period + 1 frame; cue loops: play the cue, then idle for the same time
    const r = await capture(id, def.page ? { steps: [{ state: 'stage', hold: tailF / FPS }], tail: 0 } : { steps: [{ cue: def.cue }], tail: tailF / FPS }, FRAMES);
    m = { N: r.frames, I: r.frames - tailF + settle, pf }; fs.writeFileSync(metaF, JSON.stringify(m));
  }
  const tCap = Date.now(), { N, I } = m;
  // seam check: frame I+pf must equal frame I; last loop frame -> first must look like any consecutive pair
  const f0 = await raw(dir, I), fN = await raw(dir, I + pf), fL = await raw(dir, I + pf - 1), a = await raw(dir, I + 100), b = await raw(dir, I + 101);
  m.seam = { 'frame I+P vs I (must be ~0)': diff(fN, f0), 'last loop frame vs first': diff(fL, f0), 'typical consecutive pair': diff(a, b) };
  console.log(`[${key}] N=${N} intro=${I} frames (${(I / FPS).toFixed(2)} s), loop=${pf}`, JSON.stringify(m.seam));

  const total = L.TARGET_S * FPS, rem = total - I, n = Math.floor(rem / pf), tailN = rem - n * pf;
  const seg = s => path.join(OUT, `${id}_${s}.mp4`), jobs = [{ out: seg('intro'), range: [0, I - 1] }, { out: seg('loop'), range: [I, I + pf - 1] }];
  if (tailN > 0) jobs.push({ out: seg('tail'), range: [I, I + tailN - 1] }); // loop prefix: file ends on a steady ambient frame
  await render(dir, N, null, jobs);
  const tRen = Date.now();

  const list = [seg('intro'), ...Array(n).fill(seg('loop')), ...(tailN > 0 ? [seg('tail')] : [])];
  const listF = path.join(OUT, id + '_list.txt');
  fs.writeFileSync(listF, list.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n');
  const final = path.join(OUT, def.files[0] + '.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', listF, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(total / FPS), '-movflags', '+faststart', final]);
  const dests = def.files.map((f, i) => { if (i) fs.copyFileSync(final, path.join(OUT, f + '.mp4')); return publish(path.join(OUT, f + '.mp4'), f + '.mp4'); });
  console.log(`[${key}] -> ${dests.join(', ')}  intro ${I}f + ${n} x loop ${pf}f + tail ${tailN}f = ${I + n * pf + tailN}f; capture ${((tCap - t0) / 1000).toFixed(0)} s, render+join ${((Date.now() - tCap) / 1000).toFixed(0)} s`);
  return { key, ...m, n, tailN };
}

(async () => {
  const T0 = Date.now(), srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/prototype/`;
  // captures: independent Chromium instances, max 3 at once; Remotion renders contend for the same CPU, so render() runs one at a time
  let active = 0; const waiting = [];
  const limited = cap => async (...a) => {
    if (active >= 3) await new Promise(r => waiting.push(r)); else active++;
    try { return await cap(...a); } finally { const w = waiting.shift(); if (w) w(); else active--; }
  };
  const unknown = keys.filter(k => !L.loops[k]);
  if (unknown.length) { console.error(`unknown loop key(s): ${unknown.join(', ')} (have: ${Object.keys(L.loops).join(' ')})`); srv.close(); process.exit(2); }
  const capCue = limited(loadCapture(base + 'loops.html'));   // capture.js reads NDPIFY_URL once, so each URL gets its own module copy
  const runs = Object.entries(L.loops).filter(([k]) => want(k)).map(([k, d]) => longClip(k, d, d.page ? limited(loadCapture(base + d.page)) : capCue));
  const done = await Promise.allSettled(runs);
  done.forEach(r => { if (r.status === 'rejected') console.error('FAILED', r.reason); });
  srv.close();
  console.log(`total ${((Date.now() - T0) / 1000).toFixed(0)} s`);
  process.exit(done.some(r => r.status === 'rejected') ? 1 : 0);
})();
