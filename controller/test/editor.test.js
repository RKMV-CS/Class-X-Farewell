'use strict';
// Sequence editor: reorder / add / remove / rename / undo / library. Temp dir only, never the real clips/ or cues.json.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CueState } = require('../cueState');
const { Controller } = require('../controller');
const { Vlc } = require('../vlc');
const { buildApp } = require('../server');
const mock = require('./mock-vlc');
const cues = require('../cues.json');

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(32)]);
const ids = (list) => list.map((c) => c.id);

async function env(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndp-edit-'));
  const list = structuredClone(cues);
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(list));
  for (const c of list) fs.writeFileSync(path.join(dir, c.file), 'old-' + c.id);
  const m = await mock.start();
  const c = new Controller({ cues: list, vlc: new Vlc({ port: m.port, clipsDir: dir }), debounceMs: 0, log: () => {} });
  const srv = buildApp(c, { clipsDir: dir, cuesFile: path.join(dir, 'cues.json') }).listen(0);
  t.after(() => { srv.close(); m.server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = (method, p, body) => fetch(base + p, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const up = (id, name) => fetch(`${base}/api/clip/${id}`, { method: 'POST', headers: { 'x-filename': encodeURIComponent(name), 'content-type': 'application/octet-stream' }, body: MP4 });
  const put = (name, body = MP4) => fetch(base + '/api/library', { method: 'POST', headers: { 'x-filename': encodeURIComponent(name), 'content-type': 'application/octet-stream' }, body });
  const state = async () => (await (await fetch(base + '/api/state')).json()).state;
  return { dir, base, c, call, up, put, state, saved: () => JSON.parse(fs.readFileSync(path.join(dir, 'cues.json'), 'utf8')) };
}

test('CueState.setCues keeps the playing cue by id and refuses to drop it', () => {
  const s = new CueState(structuredClone(cues));
  s.jump(5);
  const cur = s.current.id;
  const rev = s.rev;
  s.setCues(structuredClone(cues).reverse());
  assert.equal(s.current.id, cur);
  assert.equal(s.rev, rev + 1);
  assert.throws(() => s.setCues(structuredClone(cues).filter((c) => c.id !== cur)), /cannot be removed/);
  assert.equal(s.current.id, cur);                                   // refused edit changed nothing
  assert.throws(() => s.setCues([...structuredClone(cues), { ...cues[0] }]), /duplicate cue id/);
  assert.throws(() => s.setCues(structuredClone(cues).map((c, i) => (i ? c : { ...c, file: '../x.mp4' }))), /plain file name/);
  assert.throws(() => s.setCues(structuredClone(cues).map((c, i) => (i ? c : { ...c, file: 'x.exe' }))), /extension/);
  assert.equal(new CueState(structuredClone(cues)).snapshot().rev, 0);
});

test('reorder keeps the current cue, persists, validates the id list', async (t) => {
  const e = await env(t);
  await fetch(e.base + '/api/jump/5', { method: 'POST' });
  const cur = (await e.state()).current.id;
  const all = ids(e.c.state.cues);
  const moved = [all[10], ...all.filter((x) => x !== all[10])];
  const r = await e.call('PUT', '/api/cues/order', { ids: moved });
  assert.equal(r.status, 200);
  assert.deepEqual(ids(e.saved()), moved);
  const st = await e.state();
  assert.equal(st.current.id, cur);                                  // same cue still playing
  assert.equal(st.index, moved.indexOf(cur));
  assert.equal(st.rev, 1);
  assert.equal((await (await fetch(e.base + '/api/cues')).json()).rev, 1);
  for (const bad of [moved.slice(1), [...moved, moved[0]], [...moved.slice(1), 'nope'], 'x', null])
    assert.equal((await e.call('PUT', '/api/cues/order', { ids: bad })).status, 400);
  assert.deepEqual(ids(e.saved()), moved);
});

test('remove keeps the file, blocks the playing cue, undo restores', async (t) => {
  const e = await env(t);
  const before = ids(e.c.state.cues);
  await fetch(e.base + '/api/jump/3', { method: 'POST' });
  assert.equal((await e.call('DELETE', '/api/cue/' + before[2])).status, 409);   // playing
  assert.equal((await e.call('DELETE', '/api/cue/nope')).status, 404);
  const victim = e.c.state.cues[7];
  assert.equal((await e.call('DELETE', '/api/cue/' + victim.id)).status, 200);
  assert.equal(e.saved().length, before.length - 1);
  assert.equal(e.c.state.index, 2);                                  // removal after the playing cue: index unchanged
  assert.ok(fs.existsSync(path.join(e.dir, victim.file)));            // video stays on disk
  assert.equal((await e.call('POST', '/api/undo')).status, 200);
  assert.deepEqual(ids(e.saved()), before);
  assert.equal((await e.call('POST', '/api/undo')).status, 409);                  // nothing left to undo
});

test('removing a cue before the playing one moves the index, not the cue', async (t) => {
  const e = await env(t);
  await fetch(e.base + '/api/jump/10', { method: 'POST' });
  const cur = e.c.state.current.id;
  assert.equal((await e.call('DELETE', '/api/cue/' + e.c.state.cues[0].id)).status, 200);
  assert.equal(e.c.state.current.id, cur);
  assert.equal(e.c.state.index, 8);
});

test('the last cue cannot be removed', async (t) => {
  const e = await env(t);
  for (const c of e.c.state.cues.slice(1)) assert.equal((await e.call('DELETE', '/api/cue/' + c.id)).status, 200);
  assert.equal((await e.call('DELETE', '/api/cue/' + e.c.state.cues[0].id)).status, 400);
  assert.equal(e.c.state.cues.length, 1);
});

test('add from library: position, id, label, mode; rejects bad / unknown / used files', async (t) => {
  const e = await env(t);
  fs.writeFileSync(path.join(e.dir, 'My Extra Video.mp4'), 'x');
  fs.writeFileSync(path.join(e.dir, 'fresh.mov'), 'x');
  fs.writeFileSync(path.join(e.dir, 'notes.txt'), 'x');
  fs.mkdirSync(path.join(e.dir, '.replaced'));
  fs.writeFileSync(path.join(e.dir, '.replaced', 'old.mp4'), 'x');
  const lib = await (await fetch(e.base + '/api/library')).json();
  assert.deepEqual(lib.files.map((f) => f.file), ['fresh.mov', 'My Extra Video.mp4']);   // used clips, dot dirs, non-video files are not listed
  const first = e.c.state.cues[0].id;
  let r = await e.call('POST', '/api/cues', { file: 'fresh.mov', after: first });
  assert.equal(r.status, 200);
  const cue = (await r.json()).cue;
  assert.deepEqual([cue.id, cue.n, cue.mode, cue.label, cue.missing], ['fresh', 2, 'hold', 'fresh', false]);
  assert.equal(e.saved()[1].file, 'fresh.mov');
  r = await e.call('POST', '/api/cues', { file: 'My Extra Video.mp4', label: '  Surprise  ', mode: 'loop' });
  assert.equal(r.status, 200);
  assert.deepEqual(e.saved().at(-1), { id: 'My_Extra_Video', file: 'My Extra Video.mp4', mode: 'loop', label: 'Surprise' });
  assert.equal((await e.call('POST', '/api/cues', { file: 'fresh.mov' })).status, 409);          // already used
  for (const bad of ['../cues.json', 'a/b.mp4', '..\\x.mp4', 'x.exe', '.hidden.mp4', 5, undefined])
    assert.equal((await e.call('POST', '/api/cues', { file: bad })).status, 400, String(bad));
  assert.equal((await e.call('POST', '/api/cues', { file: 'missing.mp4' })).status, 404);
  fs.writeFileSync(path.join(e.dir, 'third.mp4'), 'x');
  assert.equal((await e.call('POST', '/api/cues', { file: 'third.mp4', after: 'nope' })).status, 400);
  assert.equal((await e.call('POST', '/api/cues', { file: 'third.mp4', mode: 'bad' })).status, 400);
  fs.writeFileSync(path.join(e.dir, 'fresh.mp4'), 'x');                                          // same stem as an existing id
  assert.equal((await e.call('POST', '/api/cues', { file: 'fresh.mp4' })).status, 200);
  assert.equal(e.saved().at(-1).id, 'fresh_2');
});

test('a removed cue returns to the library (when no other cue uses its file)', async (t) => {
  const e = await env(t);
  const victim = e.c.state.cues.find((c) => cues.filter((x) => x.file === c.file).length === 1);
  await e.call('DELETE', '/api/cue/' + victim.id);
  const lib = await (await fetch(e.base + '/api/library')).json();
  assert.deepEqual(lib.files.map((f) => f.file), [victim.file]);
  assert.equal((await e.call('POST', '/api/cues', { file: victim.file })).status, 200);
  assert.equal((await (await fetch(e.base + '/api/library')).json()).files.length, 0);
});

test('rename + mode in one call, bad label, undo', async (t) => {
  const e = await env(t);
  const id = e.c.state.cues[3].id;
  let r = await e.call('POST', '/api/cue/' + id, { label: '  New name  ', mode: 'loop' });
  assert.equal(r.status, 200);
  assert.deepEqual([e.saved()[3].label, e.saved()[3].mode], ['New name', 'loop']);
  assert.equal((await e.call('POST', '/api/cue/' + id, { label: '' })).status, 400);
  assert.equal((await e.call('POST', '/api/cue/' + id, { label: 'x'.repeat(121) })).status, 400);
  assert.equal((await e.call('POST', '/api/cue/' + id, {})).status, 400);
  r = await e.call('POST', '/api/undo');
  assert.equal(r.status, 200);
  assert.equal(e.saved()[3].label, cues[3].label);
});

test('undo never drops the playing cue and keeps a replaced video file name', async (t) => {
  const e = await env(t);
  const target = e.c.state.cues[20];
  await e.call('POST', '/api/cue/' + target.id, { label: 'Changed' });
  await fetch(e.base + '/api/jump/' + (e.c.state.cues.findIndex((c) => c.id === target.id) + 1), { method: 'POST' });
  assert.equal((await e.call('DELETE', '/api/cue/' + target.id)).status, 409);
  // a video replaced (extension change) after an edit survives undo
  const id4 = e.c.state.cues[4].id;
  await e.call('POST', '/api/cue/' + id4, { label: 'Edit before replace' });
  assert.equal((await e.up(id4, 'new.m4v')).status, 200);
  assert.equal((await e.call('POST', '/api/undo')).status, 200);
  assert.equal(e.saved()[4].file, id4 + '.m4v');
  assert.equal(e.saved()[4].label, cues[4].label);
});

test('library upload stores a new clip, refuses overwrite / bad type / traversal', async (t) => {
  const e = await env(t);
  let r = await e.put('Brand New (1).MP4');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).file, 'Brand New (1).MP4');
  assert.deepEqual(fs.readFileSync(path.join(e.dir, 'Brand New (1).MP4')), MP4);
  assert.equal((await e.put('Brand New (1).MP4')).status, 409);                  // never overwrites
  assert.equal((await e.put('x.exe')).status, 400);
  assert.equal((await e.put('../evil.mp4')).status, 400);
  assert.equal((await e.put('notvideo.mp4', Buffer.from('just text, not a video file'))).status, 400);
  assert.equal(fs.existsSync(path.join(e.dir, 'notvideo.mp4')), false);
  assert.equal((await e.put('odd name!.mp4')).status, 200);
  assert.ok(fs.existsSync(path.join(e.dir, 'odd name_.mp4')));
  const lib = await (await fetch(e.base + '/api/library')).json();
  assert.ok(lib.files.some((f) => f.file === 'Brand New (1).MP4'));
  assert.equal(lib.files.some((f) => f.file.endsWith('.part')), false);
});

test('a failed save rolls the edit back (memory matches cues.json)', async (t) => {
  const e = await env(t);
  fs.rmSync(path.join(e.dir, 'cues.json'));
  fs.mkdirSync(path.join(e.dir, 'cues.json.tmp'));                            // saveCues cannot write its temp file
  const before = ids(e.c.state.cues);
  const r = await e.call('DELETE', '/api/cue/' + before[5]);
  assert.equal(r.status, 500);
  assert.deepEqual(ids(e.c.state.cues), before);
});
