// node check.js [clip-id ...] : ffprobe summary + first/last frame PNGs (out/check/) + pixel diff of consecutive clips
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { approved } = require('./clips');
const cues = require('../controller/cues.json');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : approved;
const dir = path.join(__dirname, 'out', 'check'); fs.mkdirSync(dir, { recursive: true });
const rem = (...a) => execFileSync('npx', ['remotion', ...a], { cwd: __dirname, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const raw = async f => (await sharp(f).removeAlpha().raw().toBuffer());
(async () => {
  const ends = {};
  for (const id of ids) {
    const mp4 = path.resolve(__dirname, '..', 'controller', 'clips', cues.find(c => c.id === id).file);
    const pr = JSON.parse(execFileSync('npx', ['remotion', 'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4], { cwd: __dirname, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const v = pr.streams.find(s => s.codec_type === 'video'), a = pr.streams.find(s => s.codec_type === 'audio');
    console.log(id, `${v.codec_name} ${v.pix_fmt} ${v.width}x${v.height} ${v.r_frame_rate}fps`, a ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` : 'NO AUDIO', `${(+pr.format.duration).toFixed(2)}s`, `${(fs.statSync(mp4).size / 1e6).toFixed(1)}MB`);
    const first = path.join(dir, id + '_first.png'), last = path.join(dir, id + '_last.png');
    rem('ffmpeg', '-y', '-i', `"${mp4}"`, '-frames:v', '1', `"${first}"`);
    rem('ffmpeg', '-y', '-sseof', '-0.2', '-i', `"${mp4}"`, '-update', '1', '-frames:v', '1', `"${last}"`);   // keeps overwriting: ends on the final frame
    ends[id] = { first, last };
  }
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = await raw(ends[ids[i]].last), b = await raw(ends[ids[i + 1]].first);
    let sum = 0, big = 0; for (let k = 0; k < a.length; k++) { const d = a[k] - b[k]; sum += d * d; if (Math.abs(d) > 12) big++; }
    console.log(`continuity ${ids[i]} -> ${ids[i + 1]}: RMSE ${Math.sqrt(sum / a.length).toFixed(2)} (0-255), ${(100 * big / a.length).toFixed(3)}% channel values off by >12`);
  }
})().catch(e => { console.error(e.stderr || e); process.exit(1); });
