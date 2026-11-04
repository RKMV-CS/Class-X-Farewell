// node levels.js clip-id ... : decode the AAC track of controller/clips/<id>.mp4 and print mean (RMS) / max dBFS (remotion's ffmpeg has no volumedetect)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cues = require('../controller/cues.json');
for (const id of process.argv.slice(2)) {
  const mp4 = path.resolve(__dirname, '..', 'controller', 'clips', cues.find(c => c.id === id).file), wav = path.join(__dirname, 'out', id + '.dec.wav');
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-i', `"${mp4}"`, '-vn', '-acodec', 'pcm_s16le', '-ac', '2', '-ar', '48000', `"${wav}"`], { cwd: __dirname, shell: true, stdio: 'ignore' });
  const all = fs.readFileSync(wav), b = all.subarray(all.indexOf('data') + 8), n = b.length >> 1;   // skip RIFF header up to the data chunk
  let sum = 0, mx = 0;
  for (let i = 0; i < n; i++) { const v = b.readInt16LE(i * 2) / 32768; sum += v * v; mx = Math.max(mx, Math.abs(v)); }
  const db = x => (20 * Math.log10(x || 1e-9)).toFixed(1);
  console.log(`${id}: mean ${db(Math.sqrt(sum / n))} dBFS, max ${db(mx)} dBFS, ${(n / 2 / 48000).toFixed(2)} s`);
  fs.unlinkSync(wav);
}
