'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkClips, cueReport, buildManifest } = require('../setup');

function tmp(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ndp-setup-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

test('checkClips: ok / missing / differs', (t) => {
  const d = tmp(t);
  fs.writeFileSync(path.join(d, 'a.mp4'), '12345');
  fs.writeFileSync(path.join(d, 'b.mp4'), '123');
  const r = checkClips({ files: { 'a.mp4': 5, 'b.mp4': 9, 'c.mp4': 1 } }, d);
  assert.deepEqual(r.ok, ['a.mp4']);
  assert.deepEqual(r.missing, ['c.mp4']);
  assert.deepEqual(r.differs, [{ name: 'b.mp4', have: 3, want: 9 }]);
});

test('cueReport: missing cue files and unused clips (dot folders and non-video files ignored)', (t) => {
  const d = tmp(t);
  for (const f of ['a.mp4', 'extra.mov', 'notes.txt']) fs.writeFileSync(path.join(d, f), 'x');
  fs.mkdirSync(path.join(d, '.download'));
  fs.writeFileSync(path.join(d, '.download', 'part.mp4'), 'x');
  const r = cueReport([{ file: 'a.mp4' }, { file: 'gone.mp4' }, { file: 'a.mp4' }], d);
  assert.deepEqual(r.missing, ['gone.mp4']);
  assert.deepEqual(r.unused, ['extra.mov']);
  assert.deepEqual(cueReport([{ file: 'x.mp4' }], path.join(d, 'nope')), { missing: ['x.mp4'], unused: [] });
});

test('buildManifest lists clip files with their sizes, sorted', (t) => {
  const d = tmp(t);
  fs.writeFileSync(path.join(d, 'z.mp4'), '12');
  fs.writeFileSync(path.join(d, 'a.m4v'), '1');
  fs.writeFileSync(path.join(d, 'skip.txt'), 'x');
  const m = buildManifest(d, { source: 'o/r', tag: 't1' });
  assert.deepEqual(Object.entries(m.files), [['a.m4v', 1], ['z.mp4', 2]]);
  assert.equal(m.source, 'o/r');
  assert.equal(m.tag, 't1');
});

test('the committed manifest covers every clip the show needs', () => {
  const m = require('../clips.manifest.json');
  const cues = require('../cues.json');
  assert.match(m.source, /^[\w.-]+\/[\w.-]+$/);
  assert.ok(m.tag);
  for (const c of cues) assert.ok(m.files[c.file] > 0, `manifest lacks ${c.file}`);
});
