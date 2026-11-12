// node render/collect-clips.js <segmentsDir> <loopsDir> <outDir> [cues.json]
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

module.exports = { controllerName, studentCount, plan };

if (require.main === module) {
  const [segDir, loopDir, outDir, cuesF = path.join(__dirname, '..', 'controller', 'cues.json')] = process.argv.slice(2);
  if (!segDir || !loopDir || !outDir) { console.error('usage: node collect-clips.js <segmentsDir> <loopsDir> <outDir> [cues.json]'); process.exit(2); }
  const mp4s = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.mp4')) : [];
  const cues = JSON.parse(fs.readFileSync(cuesF, 'utf8')), n = studentCount(cues), cueIds = new Set(cues.map(c => c.id));
  const { renames, missing, skipped } = plan(mp4s(segDir).map(f => f.slice(0, -4)), n);
  if (!n) { console.error(`no *_gwK_guess cue in ${cuesF}`); process.exit(1); }
  if (missing.length) { console.error(`missing Guess Who segments for ${n} kids: ${missing.join(', ')}`); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, name] of renames) { fs.copyFileSync(path.join(segDir, id + '.mp4'), path.join(outDir, name + '.mp4')); if (!cueIds.has(name)) console.warn(`warning: ${name} is not a cue id in cues.json`); }
  const loops = mp4s(loopDir);
  for (const f of loops) fs.copyFileSync(path.join(loopDir, f), path.join(outDir, f));
  console.log(`${n} kids: ${renames.length} Guess Who clips renamed, ${loops.length} loop clips copied -> ${outDir}`);
  console.log(`loops: ${loops.join(' ')}\nnot copied (not controller clips): ${skipped.join(' ')}`);
}
