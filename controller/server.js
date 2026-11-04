'use strict';
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const express = require('express');
const { Vlc } = require('./vlc');
const { Controller } = require('./controller');
const displays = require('./displays');

const PORT = Number(process.env.PORT || 3000);
const VLC_PORT = Number(process.env.VLC_PORT || 8080);
const VLC_PASSWORD = process.env.VLC_PASSWORD || 'farewell';
// CLIPS_DIR / CUES_FILE let a second instance (or a test) run on a copy without touching the real show files.
const clipsDir = path.resolve(process.env.CLIPS_DIR || path.join(__dirname, 'clips'));
const cuesFile = path.resolve(process.env.CUES_FILE || path.join(__dirname, 'cues.json'));
const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));

const vlc = new Vlc({ port: VLC_PORT, password: VLC_PASSWORD, clipsDir });
const ctl = new Controller({ cues, vlc });

const CLIP_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.m4v'];
const MAX_CLIP_BYTES = 6 * 1024 ** 3;

// Atomic: write beside the target, then rename over it. Keeps the one-cue-per-line layout of cues.json.
function saveCues(file, list) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, '[\n' + list.map((c) => '  ' + JSON.stringify(c)).join(',\n') + '\n]\n');
  fs.renameSync(tmp, file);
}

// Cheap sanity check that the upload is a video container of the claimed kind (not a renamed .exe/.txt).
async function looksLikeVideo(file, ext) {
  const fh = await fsp.open(file, 'r');
  const b = Buffer.alloc(12);
  try { await fh.read(b, 0, 12, 0); } finally { await fh.close(); }
  if (ext === '.mkv' || ext === '.webm') return b.readUInt32BE(0) === 0x1a45dfa3;
  return /^(ftyp|moov|mdat|free|wide|skip)$/.test(b.toString('latin1', 4, 8));
}

// req.pipe to a temp file, counting bytes. Rejects (with .status) on overflow or an aborted upload.
function receive(req, file, max) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    let n = 0, done = false;
    const stop = (err) => { if (done) return; done = true; req.unpipe(out); out.destroy(); reject(err); };
    req.on('data', (b) => { n += b.length; if (n > max) stop(Object.assign(new Error('file too large (limit 6 GB)'), { status: 413 })); });
    req.on('close', () => { if (!req.complete) stop(new Error('upload aborted')); });
    req.on('error', stop);
    out.on('error', stop);
    out.on('finish', () => { if (!done) { done = true; resolve(n); } });
    req.pipe(out);
  });
}

function buildApp(controller, opts = {}) {
  const dir = opts.clipsDir || clipsDir;
  const cuesPath = opts.cuesFile || cuesFile;
  const maxBytes = opts.maxBytes || MAX_CLIP_BYTES;
  const busy = new Set();
  const info = (c, i) => {
    let size = null, mtime = null;
    try { const s = fs.statSync(path.join(dir, c.file)); size = s.size; mtime = s.mtimeMs; } catch (e) { /* missing */ }
    return { n: i + 1, id: c.id, label: c.label, mode: c.mode, file: c.file, size, mtime, missing: size === null };
  };
  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/state', (req, res) => res.json(controller.snapshot()));
  app.get('/api/cues', (req, res) => res.json({ index: controller.state.index, cues: controller.state.cues.map(info) }));
  // Per-cue mode (hold|loop), persisted to cues.json. A running cue picks it up via the loop watcher / next play.
  app.post('/api/cue/:id', express.json({ limit: '1kb' }), (req, res) => {
    const list = controller.state.cues;
    const i = list.findIndex((c) => c.id === req.params.id);
    if (i < 0) return res.status(404).json({ ok: false, error: 'unknown cue id' });
    const mode = req.body && req.body.mode;
    if (mode !== 'hold' && mode !== 'loop') return res.status(400).json({ ok: false, error: 'mode must be hold or loop' });
    const prev = list[i].mode;
    list[i].mode = mode;
    try { saveCues(cuesPath, list); } catch (e) { list[i].mode = prev; return res.status(500).json({ ok: false, error: 'could not save cues.json: ' + e.message }); }
    res.json({ ok: true, cue: info(list[i], i) });
  });
  // Replace a cue's video. Raw body (no multipart), filename in x-filename (only its extension is used).
  app.post('/api/clip/:id', async (req, res) => {
    const fail = (code, error, extra) => { res.set('Connection', 'close'); return res.status(code).json({ ok: false, error, ...extra }); };
    const list = controller.state.cues;
    const i = list.findIndex((c) => c.id === req.params.id);
    if (i < 0) return fail(404, 'unknown cue id');
    const cue = list[i];
    let name = null;
    try { name = decodeURIComponent(req.get('x-filename') || ''); } catch (e) { /* bad escape: rejected below */ }
    if (!name || /[\\/\0]/.test(name)) return fail(400, 'bad x-filename');
    const ext = path.extname(name).toLowerCase();
    if (!CLIP_EXTS.includes(ext)) return fail(400, 'extension must be one of ' + CLIP_EXTS.join(' '));
    if (Number(req.get('content-length') || 0) > maxBytes) return fail(413, 'file too large (limit 6 GB)');
    const cur = controller.state.current;
    if (cur && cur.id === cue.id && req.query.confirm !== '1') return fail(409, 'this cue is playing now', { needsConfirm: true });
    if (busy.has(cue.id)) return fail(409, 'an upload for this cue is already running');
    busy.add(cue.id);
    const tmpDir = path.join(dir, '.tmp'), bakDir = path.join(dir, '.replaced');
    const tmp = path.join(tmpDir, `${cue.id}.${Date.now()}.part`);
    const moved = [];
    const prevFile = cue.file;
    try {
      await fsp.mkdir(tmpDir, { recursive: true });
      await fsp.mkdir(bakDir, { recursive: true });
      if (!(await receive(req, tmp, maxBytes))) throw Object.assign(new Error('empty upload'), { status: 400 });
      if (!(await looksLikeVideo(tmp, ext))) throw Object.assign(new Error('file does not look like a ' + ext + ' video'), { status: 400 });
      const newFile = cue.id + ext;
      const newPath = path.join(dir, newFile);
      for (const f of await fsp.readdir(bakDir)) if (path.parse(f).name === cue.id) await fsp.unlink(path.join(bakDir, f));
      for (const p of new Set([path.join(dir, prevFile), newPath])) { // keep one backup, never delete
        if (!fs.existsSync(p)) continue;
        const b = path.join(bakDir, cue.id + path.extname(p));
        await fsp.rename(p, b);
        moved.push([b, p]);
      }
      await fsp.rename(tmp, newPath);
      if (newFile !== prevFile) {
        cue.file = newFile;
        try { saveCues(cuesPath, list); } catch (e) { await fsp.unlink(newPath).catch(() => {}); throw e; }
      }
      res.json({ ok: true, cue: info(cue, i) });
    } catch (e) {
      cue.file = prevFile;
      for (const [b, p] of moved.reverse()) await fsp.rename(b, p).catch(() => {});
      await fsp.unlink(tmp).catch(() => {});
      fail(e.status || 500, e.status ? e.message : 'could not replace the file (is it open in VLC?): ' + e.message);
    } finally { busy.delete(cue.id); }
  });
  // Live VLC readout for the operator dashboard (not shown on the projector).
  app.get('/api/vlc', async (req, res) => {
    try {
      const s = await controller.vlc.status();
      res.json({ state: s.state, time: s.time, length: s.length, repeat: !!s.repeat, fullscreen: !!s.fullscreen, volume: s.volume });
    } catch (e) { res.json({ error: e.message }); }
  });
  // Not a cue action, so it bypasses the cue debounce.
  app.post('/api/fullscreen', async (req, res) => {
    try { await controller.vlc.toggleFullscreen(); res.json({ ok: true }); } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.get('/api/displays', async (req, res) => {
    try { res.json(await displays.list()); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  // Preview of a display (default: first non-primary = the projector, else the primary).
  app.get('/api/screenshot.jpg', async (req, res) => {
    try {
      const ds = await displays.list();
      const wanted = req.query.screen === undefined ? (ds.find((d) => !d.primary) || ds[0]).index : Number(req.query.screen);
      res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }).send(await displays.capture(wanted));
    } catch (e) { res.status(503).json({ error: e.message }); }
  });
  app.post('/api/:action(next|prev|replay|pause)', async (req, res) =>
    res.json(await controller.handle(req.params.action, 'phone:' + (req.ip || '?'))));
  app.post('/api/jump/:n', async (req, res) =>
    res.json(await controller.handle('jump', 'phone:' + (req.ip || '?'), req.params.n)));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ ok: false, error: err.message }));
  return app;
}

function lanUrls(port) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${port}`);
  return out;
}

// Prefer a home/venue LAN address: WSL/Hyper-V/Docker adapters (172.x) are unreachable from a phone.
function phoneUrl(port) {
  const urls = lanUrls(port);
  return urls.find((u) => u.includes('//192.168.')) || urls.find((u) => u.includes('//10.')) || urls[0] || null;
}

function printQr(url) {
  try { require('qrcode-terminal').generate(url, { small: true }); } catch (e) { /* package missing: the URL printed above still works */ }
}

function checkClips() {
  const missing = cues.filter((c) => !fs.existsSync(path.join(clipsDir, c.file)));
  if (missing.length) console.warn(`WARNING: ${missing.length} clip(s) missing in clips/: ${missing.map((c) => c.file).join(', ')}\n         (run ./gen-dummy-clips.sh for test clips)`);
}

// Terminal keys (raw mode). Escape sequences: Right ESC[C, Left ESC[D, PgDn ESC[6~, PgUp ESC[5~.
function setupKeyboard(controller) {
  if (!process.stdin.isTTY) { console.log('stdin is not a TTY: keyboard control disabled (phone remote still works).'); return; }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (k) => {
    // Each 'data' event is one key press (or one auto-repeat); repeats are dropped by the 300ms debounce.
    switch (k) {
      case ' ': case '\x1b[C': case '\x1b[6~': case '\x1bOC': return controller.handle('next', 'key');
      case '\x1b[D': case '\x1b[5~': case '\x1bOD': return controller.handle('prev', 'key');
      case 'r': case 'R': return controller.handle('replay', 'key');
      case 'p': case 'P': return controller.handle('pause', 'key');
      case 'q': case 'Q': case '\x03': console.log('Quit.'); process.exit(0);
      default:
        if (/^[0-9]$/.test(k)) return controller.handle('jump', 'key', k === '0' ? 10 : Number(k));
    }
  });
}

if (require.main === module) {
  checkClips();
  const app = buildApp(ctl);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cue controller: ${cues.length} cues, VLC http on 127.0.0.1:${VLC_PORT}`);
    console.log('Phone remote: ' + (lanUrls(PORT).join('  ') || `http://localhost:${PORT}`));
    const phone = phoneUrl(PORT);
    if (phone) { console.log(`\nScan with your phone to open the dashboard (${phone}):`); printQr(phone); }
    console.log('Keys: Space/Right/PgDn=next  Left/PgUp=prev  R=replay  1-9,0(=10)=jump  P=pause  Q=quit');
    console.log('Press a key to start (first "next" plays cue 1).');
    setupKeyboard(ctl);
    setInterval(() => ctl.tick(), 500);
  });
}
module.exports = { buildApp };
