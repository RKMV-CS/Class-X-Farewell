// Synthesized UI sound effects -> one 48 kHz stereo 16-bit WAV per clip (audio/<id>.wav). No deps.
// Event times are the cue timelines of prototype/index.html (sum of its wait()s), relative to go(cue); build() shifts them one frame
// earlier because the first captured frame is virtual t = 1/30.
const fs = require('fs');
const path = require('path');
const SR = 48000, FRAME = 1 / 30;
let seed = 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// place a mono sample array into the stereo mix at time t (s), linear gain, pan -1..1
function put(mix, t, x, gain = 1, pan = 0) {
  const o = Math.round(t * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < x.length && o + i < mix[0].length; i++) { if (o + i < 0) continue; mix[0][o + i] += x[i] * gl; mix[1][o + i] += x[i] * gr; }
}
// partials with exponential decay and optional pitch glide f0 -> f1
function tone({ f0, f1 = f0, dur, att = 0.004, decay = 0.3, partials = [[1, 1]] }) {
  const n = Math.round(dur * SR), x = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 * Math.pow(f1 / f0, i / n); ph += 2 * Math.PI * f / SR;
    let s = 0; for (const [m, a] of partials) s += a * Math.sin(ph * m);
    x[i] = s * Math.min(1, i / (att * SR + 1)) * Math.exp(-i / SR / decay) * Math.min(1, (n - i) / (0.01 * SR));
  }
  return x;
}
const bell = (f, dur, decay) => tone({ f0: f, dur, decay, partials: [[1, 1], [2.76, 0.35], [5.4, 0.15], [8.93, 0.06]] });
// band-passed noise with a swept centre frequency and amplitude shape(u), u = 0..1
function noise({ dur, f0, f1, q = 1.5, shape }) {
  const n = Math.round(dur * SR), x = new Float32Array(n); let low = 0, band = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, fc = Math.min(14000, f0 * Math.pow(f1 / f0, u)), f = 2 * Math.sin(Math.PI * fc / (2 * SR)), inp = rnd();   // 2x oversampled state-variable filter
    for (let k = 0; k < 2; k++) { const high = inp - low - band / q; band += f * high; low += f * band; }
    x[i] = band * shape(u);
  }
  return x;
}
const bump = (a = 0.5, p = 1.5) => u => Math.pow(Math.sin(Math.PI * Math.pow(u, Math.log(0.5) / Math.log(a))), p); // peaks at u = a
const click = () => {
  const x = noise({ dur: 0.012, f0: 3500, f1: 1800, q: 0.8, shape: u => 1 - u }), t = tone({ f0: 1500, f1: 700, dur: 0.03, decay: 0.008 });
  return t.map((v, i) => v * 0.8 + (x[i] || 0) * 0.5);
};
const tick = (f, g) => tone({ f0: f, f1: f * 0.9, dur: 0.05, decay: 0.01 }).map(v => v * g);
const scale = (x, f) => x.map((v, i) => v * f(i / x.length));

// Schroeder-style stereo reverb added to the mix
function reverb(mix, wet) {
  const comb = [1116, 1188, 1277, 1356], ap = [225, 556];
  const out = mix.map((ch, c) => {
    const y = new Float32Array(ch.length);
    for (const d0 of comb) {
      const d = d0 + (c ? 23 : 0), buf = new Float32Array(d); let p = 0, lp = 0;
      for (let i = 0; i < ch.length; i++) { const o = buf[p]; lp = o * 0.7 + lp * 0.3; buf[p] = ch[i] + lp * 0.82; p = (p + 1) % d; y[i] += o * 0.25; }
    }
    for (const d0 of ap) { const d = d0 + (c ? 11 : 0), buf = new Float32Array(d); let p = 0; for (let i = 0; i < ch.length; i++) { const o = buf[p], v = y[i] + o * 0.5; buf[p] = v; y[i] = o - v * 0.5; p = (p + 1) % d; } }
    return y;
  });
  for (let c = 0; c < 2; c++) for (let i = 0; i < mix[c].length; i++) mix[c][i] += out[c][i] * wet;
}

// port of sting() in prototype/index.html (Get Pro): arpeggio + sub thump + noise rise, as offline samples (master .55)
function wtone(f, dur, type, vol) {
  const n = Math.round((dur + 0.05) * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, ph = (f * t) % 1, w = type === 'sine' ? Math.sin(2 * Math.PI * ph) : 4 * Math.abs(ph - 0.5) - 1;
    x[i] = w * (t < 0.012 ? 0.0001 * Math.pow(vol / 0.0001, t / 0.012) : t < dur ? vol * Math.pow(0.0001 / vol, (t - 0.012) / (dur - 0.012)) : 0);
  }
  return x;
}
function sting() {
  const m = [new Float32Array(Math.round(2.6 * SR)), new Float32Array(Math.round(2.6 * SR))];
  const add = (t, x, g = 1) => put(m, t, x, g * 0.55, 0);
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { add(i * 0.07, wtone(f, 0.9, 'triangle', 0.22)); add(i * 0.07, wtone(f * 2, 0.5, 'sine', 0.05)); });
  [261.63, 523.25, 659.25, 783.99, 1046.5].forEach(f => add(0.42, wtone(f, 1.9, 'triangle', 0.12)));
  const kick = new Float32Array(Math.round(0.7 * SR)); let ph = 0;
  for (let i = 0; i < kick.length; i++) { const t = i / SR, f = t < 0.4 ? 150 * Math.pow(46 / 150, t / 0.4) : 46; ph += 2 * Math.PI * f / SR; kick[i] = Math.sin(ph) * (t < 0.01 ? 0.0001 * Math.pow(0.7 / 0.0001, t / 0.01) : t < 0.6 ? 0.7 * Math.pow(0.0001 / 0.7, (t - 0.01) / 0.59) : 0); }
  add(0, kick);
  add(0.3, noise({ dur: 0.9, f0: 2500, f1: 9000, q: 1.2, shape: u => { const t = u * 0.9; return t < 0.1 ? 0.0001 * Math.pow(0.09 / 0.0001, t / 0.1) * 6 : 0.09 * Math.pow(0.0001 / 0.09, (t - 0.1) / 0.8) * 6; } }));
  return [m[0], m[1]]; // stereo (mono-in-both) pair
}
const putStereo = (mix, t, st, g = 1) => { const o = Math.round(t * SR); for (let c = 0; c < 2; c++) for (let i = 0; i < st[c].length && o + i < mix[c].length; i++) mix[c][o + i] += st[c][i] * g; };

// ---- per-clip sound design: wet = reverb amount, peak = final peak dBFS, build(mix) places events (seconds from go(cue)) ----
const EVENTS = {
  // Timeline re-verified against the current prototype on 2026-11-04 (events unchanged, they already match the 20.74 s cue).
  // Install cue (starts on the held App Store frame, no idle lead-in). Timeline from the cue code, seconds from go(1):
  // cursor lands 1.44, click 1.74 (curClick resolves 2.04) -> Face ID sheet in 2.04 (.5) -> white scan 2.54-4.34 -> deny/shake 4.34-5.34 (+.3 reset)
  // -> green portrait draw 5.64-8.39 -> saffron pop 8.39 (spark chime) -> verified + check 8.64-9.64 -> sheet out 9.64-10.14 -> ring 10.14, progress 10.64-17.14, Installed 18.04, black 19.34
  '01_store_download': { wet: 0.12, peak: -3, build(m) {
    put(m, 1.74, click(), 0.55, 0.15); put(m, 1.74 + 0.075, click(), 0.18, 0.15);                                     // GET click
    put(m, 2.04, noise({ dur: 0.5, f0: 900, f1: 3000, q: 1.2, shape: bump(0.5, 1.4) }), 0.25, 0);                     // sheet in (soft air)
    [2.7, 3.05, 3.4, 3.75, 4.1].forEach((t, k) => put(m, t, tick(1500 + k * 180, 0.4), 0.28, (k - 2) * 0.12));         // white scan blips (rising)
    [4.34, 4.54].forEach(t => put(m, t, tone({ f0: 170, f1: 140, dur: 0.12, att: 0.003, decay: 0.07, partials: [[1, 1], [2, 0.6], [3, 0.4], [5, 0.2]] }), 0.5, 0)); // deny buzz x2 (shake)
    put(m, 5.64, tick(1300, 0.35), 0.3, 0);                                                                           // retry ready
    [5.9, 6.5, 7.1, 7.7, 8.3].forEach((t, k) => put(m, t, bell(784 * Math.pow(2, [0, 2, 4, 7, 9][k] / 12), 0.6, 0.18), 0.07 + k * 0.01, (k - 2) * 0.15)); // green draw: soft rising pings
    put(m, 8.39, tone({ f0: 196, f1: 392, dur: 0.5, att: 0.004, decay: 0.22, partials: [[1, 1], [2, 0.5], [3, 0.2]] }), 0.42, 0);                       // saffron pop: warm rising thump
    put(m, 8.39, noise({ dur: 0.6, f0: 1800, f1: 7000, q: 1.0, shape: bump(0.3, 1.6) }), 0.22, 0);                                                   // sparkle burst
    [2093, 2637, 3136].forEach((f, k) => put(m, 8.45 + k * 0.07, bell(f, 0.9, 0.22), 0.1, (k - 1) * 0.35));                                          // tiny sparks
    put(m, 8.64, bell(1046.5, 1.4, 0.4), 0.38, -0.1); put(m, 8.72, bell(1568, 1.8, 0.5), 0.4, 0.1);                   // success chime
    put(m, 8.8, tick(2200, 0.3), 0.25, 0);                                                                            // check pop
    put(m, 9.64, noise({ dur: 0.5, f0: 3000, f1: 700, q: 1.0, shape: bump(0.4, 1.4) }), 0.18, 0);                     // sheet out
    put(m, 10.14, tick(2600, 0.35), 0.5, 0.2);                                                                        // ring starts
    put(m, 18.04, bell(659.25, 1.6, 0.45), 0.5, -0.1); put(m, 18.24, bell(880, 2.0, 0.55), 0.5, 0.1);                 // "Installed"
  } },
  // Open cue, timeline re-verified against the current prototype on 2026-11-04 (cue code + frame check of 003_open.mp4):
  // hello strokes 0.6-3.86, sheens 4.3-5.1 (s2 starts 4.71), hello out 5.66, cursor on dock icon 9.30, click 9.80, genie 10.35-11.35, splash 11.35
  '02_ndpify_open': { wet: 0.25, peak: -3, build(m) {
    put(m, 0.3, noise({ dur: 5.6, f0: 2500, f1: 6000, q: 0.9, shape: bump(0.55, 2) }), 0.5, 0);                   // airy shimmer swell
    put(m, 0.6, scale(tone({ f0: 520, f1: 1560, dur: 3.25, att: 0.2, decay: 4, partials: [[1, 0.6], [2, 0.25]] }), u => 0.07 * Math.min(1, (1 - u) * 5)), 1, 0); // pen pitch rises while writing
    const pent = [0, 2, 4, 7, 9];                                                                                   // glassy tinkle, rising pentatonic
    for (let k = 0; k < 14; k++) put(m, 0.65 + k * 0.23, bell(523.25 * Math.pow(2, (pent[k % 5] + 12 * Math.floor(k / 5)) / 12), 0.7, 0.18), 0.12 + k * 0.004, Math.sin(k * 1.7) * 0.5);
    put(m, 3.9, bell(1318.5, 1.6, 0.5), 0.2, -0.3); put(m, 3.97, bell(1975.5, 1.6, 0.5), 0.14, 0.3);               // sparkle when writing completes
    put(m, 5.0, bell(1568, 1.4, 0.45), 0.14, 0.2);                                                                  // second sheen
    put(m, 5.66, noise({ dur: 1.0, f0: 5000, f1: 900, q: 0.8, shape: bump(0.35, 1.5) }), 0.6, 0);                   // dissolve whoosh
    put(m, 9.3, tick(1800, 0.3), 0.5, 0.3);                                                                         // dock hover tick
    put(m, 9.8, click(), 0.55, 0.2); put(m, 9.875, click(), 0.18, 0.2);                                             // click
    put(m, 10.35, noise({ dur: 1.1, f0: 250, f1: 5200, q: 2.2, shape: bump(0.7, 1.2) }), 1.0, 0);                    // genie noise sweep
    put(m, 10.35, scale(tone({ f0: 110, f1: 720, dur: 1.0, att: 0.1, decay: 2, partials: [[1, 0.7], [2, 0.2]] }), bump(0.75, 1)), 0.28, 0); // genie pitch glide
    [261.63, 329.63, 392, 523.25].forEach((f, k) => put(m, 11.35 + k * 0.09, tone({ f0: f, dur: 2.2, att: 0.01, decay: 0.8, partials: [[1, 1], [2, 0.18], [3, 0.05]] }), 0.28, (k - 1.5) * 0.25)); // welcome chime
    put(m, 11.35, tone({ f0: 130.81, dur: 2.2, att: 0.05, decay: 0.9 }), 0.22, 0);
  } },
  // Library, timeline re-verified against the current prototype on 2026-11-04 (curClick now resolves 0.3 s after the click, so the reactions land 0.3 s later):
  // cursor to nav 1.84 (hover), click 2.19, playlist slides in 2.99, cursor to new playlist 5.43 (hover), click 5.83, playlist opens 6.13
  '04_library_playlist': { wet: 0.15, peak: -4, build(m) {
    put(m, 1.84, tick(1800, 0.3), 0.5, -0.3);
    put(m, 2.19, click(), 0.55, -0.2); put(m, 2.265, click(), 0.18, -0.2);
    put(m, 2.99, noise({ dur: 0.9, f0: 600, f1: 3500, q: 1.2, shape: bump(0.4, 1.4) }), 0.5, -0.2);                 // playlist slides in
    put(m, 3.2, bell(987.77, 1.0, 0.3), 0.07, 0.2);
    put(m, 5.43, tick(1800, 0.3), 0.5, 0.2);
    put(m, 5.83, click(), 0.55, 0.1); put(m, 5.905, click(), 0.18, 0.1);
    put(m, 6.13, noise({ dur: 0.8, f0: 500, f1: 3000, q: 1.2, shape: bump(0.4, 1.4) }), 0.4, 0.1);                  // playlist opens
  } },
  // Ad break, timeline re-verified against the current prototype on 2026-11-04 (frames of 007_adbreak.mp4):
  // app dissolves to the ad screen 0.2-1.0 (layers() flips at 0, not 0.9), cursor reaches Get Pro 4.14, hover, click + sting 4.59
  '06_adbreak_intro': { wet: 0.2, peak: -3, build(m) {
    put(m, 0.15, noise({ dur: 1.2, f0: 800, f1: 3000, q: 1.0, shape: bump(0.4, 1.6) }), 0.3, 0);
    put(m, 4.14, tick(1800, 0.3), 0.5, 0.2);
    put(m, 4.59, click(), 0.3, 0.1); putStereo(m, 4.59, sting(), 1);
  } },
  // Timeline re-verified against the current prototype on 2026-11-04 (home dissolve visible 0.45-2.4, unchanged).
  // splash dissolves into Home at 0.5 (2.2 s): very quiet airy pad and a whisper of air
  '03_home_trending': { wet: 0.3, peak: -22, build(m) {
    put(m, 0.3, noise({ dur: 2.0, f0: 1500, f1: 3500, q: 0.8, shape: bump(0.4, 2) }), 0.7, 0);
    [261.63, 392, 659.25].forEach((f, k) => put(m, 0.35, scale(tone({ f0: f, dur: 2.2, att: 0.8, decay: 1.2, partials: [[1, 1], [1.004, 0.6]] }), bump(0.4, 1)), 0.3, (k - 1) * 0.3));
  } },
};

function build(id, seconds, outDir = path.join(__dirname, 'audio')) {
  const ev = EVENTS[id]; if (!ev) throw new Error(`no sound events for ${id} (add it to EVENTS in audio.js)`);
  seed = 1;
  const len = Math.round(seconds * SR), mix = [new Float32Array(len), new Float32Array(len)];
  ev.build(mix); reverb(mix, ev.wet);
  const sh = Math.round(FRAME * SR), fade = Math.round(0.03 * SR); let pk = 0;
  for (const ch of mix) {
    ch.copyWithin(0, sh); ch.fill(0, len - sh);
    for (let i = 0; i < fade; i++) { ch[i] *= i / fade; ch[len - 1 - i] *= i / fade; }   // 30 ms fades: cuts between clips are silent
    for (const v of ch) pk = Math.max(pk, Math.abs(v));
  }
  const g = Math.pow(10, ev.peak / 20) / (pk || 1), buf = Buffer.alloc(44 + len * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
  for (let i = 0; i < len; i++) for (let c = 0; c < 2; c++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[c][i] * g * 32767))), 44 + i * 4 + c * 2);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, id + '.wav'); fs.writeFileSync(file, buf); return file;
}
module.exports = { build, EVENTS };
if (require.main === module) for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(EVENTS)) {
  const n = fs.readdirSync(path.join(__dirname, 'frames', id)).filter(f => f.endsWith('.jpg')).length;
  console.log(build(id, n / 30));
}
