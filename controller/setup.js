'use strict';
// One-command setup for the finished show: npm ci -> download the 71 finished clips from the private GitHub release ->
// verify sizes -> check cues.json against clips/. Safe to re-run: only missing files are fetched.
//
//   node setup.js                  full setup (what setup.bat / setup.sh / "npm run setup" run)
//   node setup.js --check          verify only, no network
//   node setup.js --repair         also re-download files whose size differs from the release (replaces your own edits!)
//   node setup.js --write-manifest [--source owner/repo] [--tag tag]   rebuild clips.manifest.json from ./clips
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CLIP_EXTS } = require('./cueState');

const DIR = __dirname;
const MANIFEST = path.join(DIR, 'clips.manifest.json');
const CLIPS = path.join(DIR, 'clips');

const isClip = (f) => !f.startsWith('.') && CLIP_EXTS.includes(path.extname(f).toLowerCase());
const sizeOf = (p) => { try { const s = fs.statSync(p); return s.isFile() ? s.size : null; } catch (e) { return null; } };

// Pure: compare a manifest ({files:{name:bytes}}) with a folder.
function checkClips(manifest, dir) {
  const r = { ok: [], missing: [], differs: [] };
  for (const [name, bytes] of Object.entries(manifest.files)) {
    const have = sizeOf(path.join(dir, name));
    if (have === null) r.missing.push(name);
    else if (have === bytes) r.ok.push(name);
    else r.differs.push({ name, have, want: bytes });
  }
  return r;
}

// Pure: every cue's file must exist; clips nobody uses are reported (harmless).
function cueReport(cues, dir) {
  const used = new Set(cues.map((c) => c.file));
  const missing = [...used].filter((f) => sizeOf(path.join(dir, f)) === null);
  let files = [];
  try { files = fs.readdirSync(dir).filter(isClip); } catch (e) { /* no folder yet */ }
  return { missing, unused: files.filter((f) => !used.has(f)) };
}

function buildManifest(dir, { source, tag }) {
  const files = {};
  for (const f of fs.readdirSync(dir).filter(isClip).sort()) files[f] = sizeOf(path.join(dir, f));
  return { source, tag, note: 'Finished show clips: name -> bytes. They live in the private release above, not in git.', files };
}

const gb = (b) => (b / 1024 ** 3).toFixed(2) + ' GB';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

function readManifest() {
  if (!fs.existsSync(MANIFEST)) throw new Error('controller/clips.manifest.json is missing. Is this a full checkout?');
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function ghReady(manifest) {
  if (run('gh', ['--version']).error) {
    console.error('FAIL  GitHub CLI (gh) is not installed. Install it from https://cli.github.com , then run: gh auth login');
    return false;
  }
  if (run('gh', ['auth', 'status']).status !== 0) {
    console.error('FAIL  gh is not logged in. Run: gh auth login');
    console.error(`      The clips are in the private repo ${manifest.source}. Ask the show owner to add your GitHub account as a collaborator.`);
    return false;
  }
  return true;
}

// Download into clips/.download first, then move only size-verified files into place, so an interrupted download can
// never leave a truncated file that looks like a finished clip.
function download(manifest, names) {
  const tmp = path.join(CLIPS, '.download');
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of fs.readdirSync(tmp)) if (sizeOf(path.join(tmp, f)) !== manifest.files[f]) fs.unlinkSync(path.join(tmp, f)); // stale partial
  const need = names.filter((n) => sizeOf(path.join(tmp, n)) !== manifest.files[n]);
  if (need.length) {
    console.log(`Downloading ${need.length} file(s) (${gb(need.reduce((a, n) => a + manifest.files[n], 0))}) from ${manifest.source} @ ${manifest.tag} ...`);
    const args = ['release', 'download', manifest.tag, '-R', manifest.source, '-D', tmp, '--skip-existing'];
    for (const n of need) args.push('-p', n);
    const r = run('gh', args, { stdio: 'inherit', encoding: undefined });
    if (r.status !== 0) console.error('WARN  gh stopped before finishing. Run setup again: it continues where it stopped.');
  }
  let moved = 0;
  for (const n of names) {
    const src = path.join(tmp, n);
    if (sizeOf(src) === manifest.files[n]) { fs.renameSync(src, path.join(CLIPS, n)); moved++; }
  }
  try { fs.rmdirSync(tmp); } catch (e) { /* partials left for the next run */ }
  return moved;
}

function summary(manifest) {
  const r = checkClips(manifest, CLIPS);
  const total = Object.keys(manifest.files).length;
  console.log(`${r.ok.length}/${total} clips match the release (${gb(r.ok.reduce((a, n) => a + manifest.files[n], 0))}).`);
  if (r.differs.length) console.log(`NOTE  ${r.differs.length} clip(s) differ from the release (replaced on purpose, or damaged): ${r.differs.map((d) => d.name).join(', ')}. Use --repair to restore the release version.`);
  if (r.missing.length) console.log(`MISSING ${r.missing.length}: ${r.missing.join(', ')}`);
  return r;
}

function main(argv) {
  const flag = (n) => argv.includes(n);
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  if (flag('--write-manifest')) {
    let prev = {};
    try { prev = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { /* first time */ }
    const source = arg('--source') || prev.source, tag = arg('--tag') || prev.tag;
    if (!source || !tag) throw new Error('give --source owner/repo and --tag <release tag>');
    const m = buildManifest(CLIPS, { source, tag });
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
    console.log(`Wrote clips.manifest.json: ${Object.keys(m.files).length} files, ${gb(Object.values(m.files).reduce((a, b) => a + b, 0))}, ${source} @ ${tag}`);
    return 0;
  }

  const manifest = readManifest();
  if (Number(process.versions.node.split('.')[0]) < 18) { console.error(`FAIL  Node ${process.version} is too old, need >= 18`); return 1; }

  if (!flag('--check')) {
    if (!fs.existsSync(path.join(DIR, 'node_modules', 'express'))) {
      console.log('Installing dependencies (npm ci) ...');
      if (run('npm', ['ci'], { cwd: DIR, stdio: 'inherit', shell: true }).status !== 0) { console.error('FAIL  npm ci failed'); return 1; }
    }
    fs.mkdirSync(CLIPS, { recursive: true });
    const before = checkClips(manifest, CLIPS);
    const names = [...before.missing, ...(flag('--repair') ? before.differs.map((d) => d.name) : [])];
    if (names.length) {
      if (!ghReady(manifest)) return 1;
      download(manifest, names);
    } else console.log('All clips already present: nothing to download.');
  }

  const r = summary(manifest);
  const cues = JSON.parse(fs.readFileSync(path.join(DIR, 'cues.json'), 'utf8'));
  const cr = cueReport(cues, CLIPS);
  if (cr.missing.length) console.log(`MISSING for cues.json: ${cr.missing.join(', ')}`);
  else console.log(`OK    all ${cues.length} cues have their video.`);
  if (cr.unused.length) console.log(`INFO  ${cr.unused.length} clip(s) in clips/ are not in the show (fine): ${cr.unused.join(', ')}`);
  const good = r.missing.length === 0 && cr.missing.length === 0;
  console.log(good ? '\nReady. Start the show software with:  node launch.js   (or double-click setup.bat)' : '\nNot ready yet. Run setup again, or see docs/getting-started.md.');
  return good ? 0 : 1;
}

if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); } catch (e) { console.error('FAIL  ' + e.message); process.exit(1); }
}
module.exports = { checkClips, cueReport, buildManifest };
