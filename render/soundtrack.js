// Soundtrack for the joined show: the synthesized UI sounds of render/audio.js, placed at the start of the segment they belong to,
// plus an optional music bed. Returns a stereo 48 kHz WAV path. Offsets come from the real segment lengths, so it works for any split of the segments.
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { build } = require('./audio');

// first-segment id prefix -> sound design id in audio.js (segments with the same prefix, e.g. 003a/003b, count as one cue)
const SFX = { '002': '01_store_download', '003': '02_ndpify_open', '004': '03_home_trending', '005': '04_library_playlist', '007': '06_adbreak_intro' };

const seconds = (ffmpeg, f) => {
  const r = spawnSync(ffmpeg, ['-i', f], { encoding: 'utf8' }), m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  if (!m) throw new Error('cannot read duration of ' + f);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};

// segFiles: [[id, mp4Path]] in show order. music: optional audio file, mixed low under the effects with fades (volume expression: this ffmpeg build has no afade).
function soundtrack(ffmpeg, segFiles, outWav, { music, musicGain = 0.22 } = {}) {
  const dir = path.dirname(outWav), tmp = path.join(dir, 'sfx');
  fs.mkdirSync(tmp, { recursive: true });
  let t = 0; const at = {}, len = {};
  for (const [id, f] of segFiles) { const d = seconds(ffmpeg, f), k = id.slice(0, 3); if (at[k] === undefined) at[k] = t; len[k] = (len[k] || 0) + d; t += d; }
  const total = t, inputs = [['-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo']], chains = [];
  for (const [k, audioId] of Object.entries(SFX)) {
    if (at[k] === undefined) continue;
    const wav = build(audioId, len[k], tmp), ms = Math.round(at[k] * 1000);
    inputs.push(['-i', wav]); chains.push(`[${inputs.length - 1}]adelay=${ms}|${ms}[s${inputs.length - 1}]`);
  }
  const labels = ['[0]', ...chains.map((_, i) => `[s${i + 1}]`)];
  if (music) {
    inputs.push(['-i', music]);
    const n = inputs.length - 1;
    chains.push(`[${n}]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume='${musicGain}*min(1,t/2)*min(1,(${total.toFixed(3)}-t)/3)':eval=frame[bgm]`);
    labels.push('[bgm]');
  }
  chains.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first[out]`);
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', ...inputs.flat(), '-filter_complex', chains.join(';'), '-map', '[out]', '-t', total.toFixed(3), '-c:a', 'pcm_s16le', outWav], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('soundtrack mix failed:\n' + (r.stderr || '').slice(-1200));
  return outWav;
}
module.exports = { soundtrack };
