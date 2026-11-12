// CI-only: download Guess Who photos from Google Drive, convert to web jpgs, build a contact sheet.
//   node render/prep-photos.js            (run from anywhere; paths resolve from this file)
//   node render/prep-photos.js --selftest (pure logic only; no network, no sharp)
//
// Input: prototype/img/guesswho/sources.json, an array of
//   { "id":   "<Google Drive file id>",
//     "file": "<original filename, e.g. 'Aritra Then 1 — Enhanced.png'>",   (informational; only its extension is used)
//     "slug": "ganja|miya|abhijnan|shreyan|thobi",
//     "slot": "then1|then2|then3|then4|now|now1|now2" }
// Output: prototype/img/guesswho/<slug>_<slot>.jpg  (committed)
//         prototype/img/guesswho/_orig/<slug>_<slot>.<ext>  (downloaded originals, gitignored)
//         prototype/img/guesswho/_orig/photo-contact-sheet.jpg  (gitignored, uploaded as artifact)
// No crop: framing is done later in CSS with object-position.
const path = require('path');
const fs = require('fs');

const SLUGS = ['ganja', 'miya', 'abhijnan', 'shreyan', 'thobi'];
const SLOTS = ['then1', 'then2', 'then3', 'then4', 'now', 'now1', 'now2'];
const MAX_PX = 1600, QUALITY = 88;
const SHEET = { cols: 4, tile: 360, label: 28 };

const outName = ({ slug, slot }) => {
  if (!SLUGS.includes(slug)) throw new Error(`bad slug "${slug}" (allowed: ${SLUGS.join('|')})`);
  if (!SLOTS.includes(slot)) throw new Error(`bad slot "${slot}" (allowed: ${SLOTS.join('|')})`);
  return `${slug}_${slot}.jpg`;
};

// Grid math: cells are tile wide and tile+label tall; returns canvas size and top-left of each cell.
const gridLayout = (n, { cols, tile, label }) => {
  const rows = Math.max(1, Math.ceil(n / cols)), cellH = tile + label;
  return {
    width: cols * tile, height: rows * cellH, cellH,
    cells: Array.from({ length: n }, (_, i) => ({ left: (i % cols) * tile, top: Math.floor(i / cols) * cellH })),
  };
};

// JPEG / PNG / WebP / GIF / HEIC(ftyp) magic bytes; an HTML interstitial from Drive fails this.
const looksLikeImage = b =>
  b.length > 12 && (
    (b[0] === 0xff && b[1] === 0xd8) ||
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    b.subarray(0, 3).toString('latin1') === 'GIF' ||
    (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') ||
    b.subarray(4, 8).toString('latin1') === 'ftyp');

const xmlEsc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function selftest() {
  const assert = require('assert');
  assert.strictEqual(outName({ slug: 'ganja', slot: 'then1' }), 'ganja_then1.jpg');
  assert.strictEqual(outName({ slug: 'thobi', slot: 'now' }), 'thobi_now.jpg');
  assert.strictEqual(outName({ slug: 'miya', slot: 'now1' }), 'miya_now1.jpg');
  assert.strictEqual(outName({ slug: 'shreyan', slot: 'now2' }), 'shreyan_now2.jpg');
  assert.throws(() => outName({ slug: 'nobody', slot: 'now' }));
  assert.throws(() => outName({ slug: 'miya', slot: 'then9' }));
  const g = gridLayout(10, SHEET); // 4 cols -> 3 rows
  assert.deepStrictEqual([g.width, g.height], [1440, 3 * 388]);
  assert.deepStrictEqual(g.cells[0], { left: 0, top: 0 });
  assert.deepStrictEqual(g.cells[5], { left: 360, top: 388 });
  assert.deepStrictEqual(g.cells[9], { left: 360, top: 776 });
  assert.strictEqual(gridLayout(4, SHEET).height, 388);
  assert.strictEqual(gridLayout(5, SHEET).height, 776);
  assert.ok(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.ok(!looksLikeImage(Buffer.from('<!DOCTYPE html><html>sign in')));
  assert.strictEqual(xmlEsc('a&b<c>"d'), 'a&amp;b&lt;c&gt;&quot;d');
  console.log('prep-photos selftest OK');
}

async function download(id, retries = 3) {
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  let err;
  for (let a = 1; a <= retries; a++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!looksLikeImage(buf))
        throw new Error(`response is not an image (content-type ${res.headers.get('content-type')}, ${buf.length} bytes; ` +
          `likely a Drive HTML page: file not shared as "anyone with the link"?)`);
      return buf;
    } catch (e) {
      err = e;
      console.warn(`  attempt ${a}/${retries} failed for ${id}: ${e.message}`);
      if (a < retries) await new Promise(r => setTimeout(r, 2000 * a));
    }
  }
  throw new Error(`download failed for ${id}: ${err.message}`);
}

async function contactSheet(files, out) {
  const sharp = require('sharp');
  const { tile, label } = SHEET, g = gridLayout(files.length, SHEET);
  const composite = [];
  for (let i = 0; i < files.length; i++) {
    const img = await sharp(files[i]).resize(tile, tile, { fit: 'inside' }).jpeg().toBuffer({ resolveWithObject: true });
    const { left, top } = g.cells[i];
    composite.push({ input: img.data, left: left + Math.floor((tile - img.info.width) / 2), top: top + label + Math.floor((tile - img.info.height) / 2) });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${label}"><text x="6" y="${label - 9}" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#fff">${xmlEsc(path.basename(files[i]))}</text></svg>`;
    composite.push({ input: Buffer.from(svg), left, top });
  }
  await sharp({ create: { width: g.width, height: g.height, channels: 3, background: '#1a1a1a' } })
    .composite(composite).jpeg({ quality: 85 }).toFile(out);
}

async function main() {
  const sharp = require('sharp');
  const dir = path.resolve(__dirname, '..', 'prototype', 'img', 'guesswho');
  const orig = path.join(dir, '_orig');
  const sources = JSON.parse(fs.readFileSync(path.join(dir, 'sources.json'), 'utf8'));
  if (!Array.isArray(sources) || !sources.length) throw new Error('sources.json must be a non-empty array');
  const seen = new Set();
  for (const s of sources) {
    if (!/^[\w-]{10,}$/.test(s.id || '')) throw new Error(`bad Drive id in ${JSON.stringify(s)}`);
    const n = outName(s);
    if (seen.has(n)) throw new Error(`duplicate output ${n}`);
    seen.add(n);
  }
  fs.mkdirSync(orig, { recursive: true });
  const produced = [];
  for (const s of sources) {
    const name = outName(s), dest = path.join(dir, name);
    console.log(`${s.id} (${s.file}) -> ${name}`);
    const buf = await download(s.id);
    const ext = path.extname(s.file || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
    fs.writeFileSync(path.join(orig, name.replace(/\.jpg$/, ext)), buf);
    await sharp(buf).rotate().resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true }).toFile(dest); // sharp drops metadata by default
    const m = await sharp(dest).metadata();
    console.log(`  ${m.width}x${m.height} ${fs.statSync(dest).size} bytes`);
    produced.push(dest);
  }
  await contactSheet(produced, path.join(orig, 'photo-contact-sheet.jpg'));
  console.log(`done: ${produced.length} jpgs + contact sheet`);
}

module.exports = { outName, gridLayout, looksLikeImage, SHEET };
if (process.argv.includes('--selftest')) selftest();
else if (require.main === module) main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
