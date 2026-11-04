'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { CueState } = require('../cueState');
const { Controller } = require('../controller');
const { Vlc } = require('../vlc');
const { buildApp } = require('../server');
const mock = require('./mock-vlc');
const cues = require('../cues.json');
const SONG2 = cues.findIndex((c) => c.id === '09_nowplaying_song2') + 1;   // 1-based cue number (moves when cues are inserted before it)

test('CueState transitions', () => {
  const s = new CueState(cues);
  assert.equal(s.current, null);
  assert.equal(s.next.id, '01_store_download');
  assert.equal(s.back(), null);
  assert.equal(s.advance().id, '01_store_download');
  assert.equal(s.back(), null);                       // can't go before first
  assert.equal(s.advance().id, '02_ndpify_open');
  assert.equal(s.back().id, '01_store_download');
  assert.equal(s.replay().id, '01_store_download');
  assert.equal(s.jump(5).mode, 'loop');
  assert.equal(s.jump(99), null);
  assert.equal(s.index, 4);
  s.jump(cues.length);
  assert.equal(s.advance(), null);                    // end of show: stays
  assert.equal(s.next, null);
  assert.ok(s.snapshot().finished);
});

test('Controller + VLC (mock): commands, debounce, loop/hold repeat', async () => {
  const m = await mock.start();
  const vlc = new Vlc({ port: m.port, clipsDir: path.join(__dirname, '../clips') });
  let t = 1000; const logs = [];
  const c = new Controller({ cues, vlc, log: (x) => logs.push(x), now: () => t });

  let r = await c.handle('next', 'test');
  assert.equal(r.state.current.id, '01_store_download');
  assert.ok(m.calls.some((x) => x.command === 'in_play' && x.input.startsWith('file:///') && x.input.endsWith('01_store_download.mp4')));
  assert.equal(m.st.repeat, false);

  t += 100; r = await c.handle('next', 'test');       // double press
  assert.equal(r.reason, 'debounced'); assert.equal(c.state.index, 0);

  for (let i = 0; i < 4; i++) { t += 400; await c.handle('next', 'test'); }
  assert.equal(c.state.current.id, '05_nowplaying_song1');
  assert.equal(m.st.repeat, true);                    // loop cue turns repeat on

  t += 400; await c.handle('next', 'test');           // hold cue -> repeat off again
  assert.equal(m.st.repeat, false);

  t += 400; await c.handle('pause', 'test');
  assert.equal(m.st.state, 'paused');
  assert.equal(c.state.index, 5);                     // pause doesn't move cues

  t += 400; await c.handle('jump', 'test', cues.length);
  t += 400; r = await c.handle('next', 'test');
  assert.equal(r.reason, 'no-op');
  assert.ok(logs.length > 5);
  m.server.close();
});

test('tick restarts a loop cue parked at its end, unless the operator paused', async () => {
  const m = await mock.start();
  let t = 1000;
  const c = new Controller({ cues, vlc: new Vlc({ port: m.port, clipsDir: '.' }), log: () => {}, now: () => t });
  const parkAtEnd = () => Object.assign(m.st, { state: 'paused', length: 14, time: 14 });

  await c.handle('jump', 'test', 1); parkAtEnd();     // hold cue: left alone
  await c.tick();
  assert.equal(m.st.state, 'paused');

  t += 400; await c.handle('jump', 'test', 5); parkAtEnd();
  await c.tick();
  assert.equal(m.st.state, 'playing'); assert.equal(m.st.time, 0);

  t += 400; await c.handle('pause', 'test'); parkAtEnd();
  await c.tick();                                     // operator paused on purpose
  assert.equal(m.st.state, 'paused');
  m.server.close();
});

test('VLC down: error reported, no crash', async () => {
  const vlc = new Vlc({ port: 1, clipsDir: '.' });
  const c = new Controller({ cues, vlc, log: () => {} });
  const r = await c.handle('next', 't');
  assert.equal(r.ok, false); assert.match(r.reason, /vlc-error/);
});

test('HTTP: remote page and API', async () => {
  const m = await mock.start();
  const c = new Controller({ cues, vlc: new Vlc({ port: m.port, clipsDir: '.' }), debounceMs: 0, log: () => {} });
  const srv = buildApp(c).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /NEXT/);
  let j = await (await fetch(base + '/api/next', { method: 'POST' })).json();
  assert.equal(j.state.current.id, '01_store_download');
  assert.equal(j.state.next.id, '02_ndpify_open');
  j = await (await fetch(base + '/api/jump/' + SONG2, { method: 'POST' })).json();
  assert.equal(j.state.current.id, '09_nowplaying_song2');
  j = await (await fetch(base + '/api/prev', { method: 'POST' })).json();
  assert.equal(j.state.index, SONG2 - 2);
  j = await (await fetch(base + '/api/fullscreen', { method: 'POST' })).json();
  assert.equal(j.ok, true); assert.ok(m.calls.some((x) => x.command === 'fullscreen'));
  srv.close(); m.server.close();
});

// ---- clip replace + mode toggle (temp dir only, never the real clips/ or cues.json) ----
const fs = require('fs');
const os = require('os');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
async function clipEnv(t, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndp-clips-'));
  const list = structuredClone(cues);
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(list));
  for (const c of list) fs.writeFileSync(path.join(dir, c.file), 'old-' + c.id);
  const m = await mock.start();
  const c = new Controller({ cues: list, vlc: new Vlc({ port: m.port, clipsDir: dir }), debounceMs: 0, log: () => {} });
  const srv = buildApp(c, { clipsDir: dir, cuesFile: path.join(dir, 'cues.json'), ...extra }).listen(0);
  t.after(() => { srv.close(); m.server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const up = (id, name, body = MP4, q = '') => fetch(`${base}/api/clip/${id}${q}`, { method: 'POST', headers: { 'x-filename': encodeURIComponent(name), 'content-type': 'application/octet-stream' }, body });
  return { dir, base, c, up, saved: () => JSON.parse(fs.readFileSync(path.join(dir, 'cues.json'), 'utf8')) };
}

test('clip upload: rejects bad id, bad extension, traversal in id and x-filename', async (t) => {
  const e = await clipEnv(t);
  assert.equal((await e.up('nope', 'a.mp4')).status, 404);
  assert.equal((await e.up('..%2F..%2Fserver', 'a.mp4')).status, 404);
  assert.equal((await e.up('01_store_download', 'a.exe')).status, 400);
  assert.equal((await e.up('01_store_download', 'a')).status, 400);
  assert.equal((await e.up('01_store_download', '../../evil.mp4')).status, 400);
  assert.equal((await e.up('01_store_download', '..' + String.fromCharCode(92) + 'evil.mp4')).status, 400);
  assert.equal((await e.up('01_store_download', 'notvideo.mp4', Buffer.from('hello world, not a video'))).status, 400);
  assert.equal((await e.up('01_store_download', 'a.mp4', Buffer.alloc(0))).status, 400);
  assert.equal(fs.readFileSync(path.join(e.dir, '01_store_download.mp4'), 'utf8'), 'old-01_store_download');
  assert.deepEqual(fs.readdirSync(path.join(e.dir, '.tmp')), []);   // no leftovers
});

test('clip upload: size cap', async (t) => {
  const e = await clipEnv(t, { maxBytes: 20 });
  assert.equal((await e.up('01_store_download', 'a.mp4')).status, 413);
  assert.equal(fs.readFileSync(path.join(e.dir, '01_store_download.mp4'), 'utf8'), 'old-01_store_download');
});

test('clip upload: replace keeps one backup, same ext; different ext updates cues.json', async (t) => {
  const e = await clipEnv(t);
  let r = await e.up('02_ndpify_open', 'mine.MP4');
  assert.equal(r.status, 200);
  assert.deepEqual(fs.readFileSync(path.join(e.dir, '02_ndpify_open.mp4')), MP4);
  assert.equal(fs.readFileSync(path.join(e.dir, '.replaced', '02_ndpify_open.mp4'), 'utf8'), 'old-02_ndpify_open');
  // second replace: backup is the previous upload (one level only)
  const MP4b = Buffer.concat([MP4, Buffer.from('b')]);
  assert.equal((await e.up('02_ndpify_open', 'x.m4v', MP4b)).status, 200);   // different ext
  const j = await r.json();
  assert.equal(j.cue.file, '02_ndpify_open.mp4');
  assert.equal(e.saved().find((c) => c.id === '02_ndpify_open').file, '02_ndpify_open.m4v');
  assert.equal(e.c.state.cues[1].file, '02_ndpify_open.m4v');                     // in memory too
  assert.deepEqual(fs.readdirSync(path.join(e.dir, '.replaced')).filter((f) => f.startsWith('02_')), ['02_ndpify_open.mp4']);
  assert.deepEqual(fs.readFileSync(path.join(e.dir, '.replaced', '02_ndpify_open.mp4')), MP4);
  assert.equal(fs.existsSync(path.join(e.dir, '02_ndpify_open.mp4')), false);
  const list = await (await fetch(e.base + '/api/cues')).json();
  assert.equal(list.cues[1].file, '02_ndpify_open.m4v');
  assert.equal(list.cues[1].size, MP4b.length);
  assert.equal(list.cues[1].missing, false);
});

test('clip upload: playing cue needs confirm; cues list flags missing files', async (t) => {
  const e = await clipEnv(t);
  await fetch(e.base + '/api/next', { method: 'POST' });                          // cue 1 now playing
  let r = await e.up('01_store_download', 'a.mp4');
  assert.equal(r.status, 409);
  assert.equal((await r.json()).needsConfirm, true);
  assert.equal(fs.readFileSync(path.join(e.dir, '01_store_download.mp4'), 'utf8'), 'old-01_store_download');
  assert.equal((await e.up('01_store_download', 'a.mp4', MP4, '?confirm=1')).status, 200);
  fs.unlinkSync(path.join(e.dir, '03_home_trending.mp4'));
  const list = await (await fetch(e.base + '/api/cues')).json();
  assert.equal(list.cues[2].missing, true);
  assert.equal(list.cues[2].size, null);
});

test('cue mode toggle persists to cues.json', async (t) => {
  const e = await clipEnv(t);
  const post = (id, body) => fetch(`${e.base}/api/cue/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('07_ad_video', { mode: 'loop' })).status, 200);
  assert.equal(e.saved().find((c) => c.id === '07_ad_video').mode, 'loop');
  assert.equal(e.c.state.cues[6].mode, 'loop');
  assert.equal((await post('07_ad_video', { mode: 'banana' })).status, 400);
  assert.equal((await post('nope', { mode: 'loop' })).status, 404);
  assert.equal((await fetch(`${e.base}/api/cue/07_ad_video`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal(e.saved().find((c) => c.id === '07_ad_video').mode, 'loop');
  assert.equal(e.saved().length, cues.length);
});
