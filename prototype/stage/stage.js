/* NDPify stage page: ambient screen for songs and live-act standby. No title, performer, progress bar or timer (the kids sing live).
   ?kind=song&n=5  -> "SONG 05 · LIVE ON STAGE", palette from n    ?kind=standby -> "MB27 · THE FINAL CHAPTER", brand saffron    ?t=7.5 freezes time
   Everything animated is a PURE function of time t (s) and only touches transform/opacity. Every motion is a whole number of cycles per P = 20 s,
   so frame(t) == frame(t + 20) and render/render-long.js can capture one 20 s period and loop it seamlessly. The pure math is exported for the assert test. */
(function () {
  'use strict';
  const P = 20, TAU = Math.PI * 2;
  const rnd = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };   // deterministic hash in [0,1)
  const ph = (k, t, p) => TAU * (k * t / P + p);                                                                 // k = integer cycles per P

  // 5 aurora blobs: centre (px), size, colour slot, opacity, drift amplitude, integer cycles per P (x, y, scale), phases
  const BLOBS = [
    { x: 380, y: 160, w: 1250, h: 950, c: 1, o: .5, ax: 240, ay: 130, kx: 1, ky: 1, ks: 1, p: .00 },
    { x: 1560, y: 330, w: 1050, h: 840, c: 2, o: .38, ax: 200, ay: 160, kx: 1, ky: 2, ks: 1, p: .21 },
    { x: 980, y: 1060, w: 1350, h: 900, c: 1, o: .42, ax: 260, ay: 90, kx: 1, ky: 1, ks: 2, p: .47 },
    { x: 220, y: 900, w: 850, h: 720, c: 3, o: .3, ax: 170, ay: 140, kx: 2, ky: 1, ks: 1, p: .68 },
    { x: 1700, y: 960, w: 800, h: 700, c: 3, o: .24, ax: 150, ay: 120, kx: 1, ky: 2, ks: 1, p: .84 },
  ];
  const blobPose = (i, t) => { const b = BLOBS[i]; return { x: b.ax * Math.sin(ph(b.kx, t, b.p)), y: b.ay * Math.cos(ph(b.ky, t, b.p * 1.7)), s: 1 + .08 * Math.sin(ph(b.ks, t, b.p * 2.3)) }; };

  // soft equalizer: 56 bars, a bell-shaped envelope over two sines each (6-14 and 15-32 cycles per 20 s = 1.4-3.3 s and 0.6-1.3 s periods)
  const NB = 56, M1 = [], M2 = [], P1 = [], P2 = [];
  for (let i = 0; i < NB; i++) { M1.push(6 + Math.floor(rnd(i, 1) * 9)); M2.push(15 + Math.floor(rnd(i, 2) * 18)); P1.push(rnd(i, 3)); P2.push(rnd(i, 4)); }
  const bar = (i, t) => {
    const a = .5 + .5 * (.55 * Math.sin(ph(M1[i], t, P1[i])) + .45 * Math.sin(ph(M2[i], t, P2[i]))), x = (i + .5) / NB * 2 - 1, env = .35 + .65 * Math.exp(-2.2 * x * x);
    const v = Math.pow(a, 1.3);
    return { s: .07 + .93 * env * v, o: .3 + .5 * v };
  };

  const ring = (k, t) => { const u = (t / 10 + k / 2) % 1; return { s: 1 + .9 * u, o: .34 * (1 - u) * Math.min(1, u * 10) }; };     // 2 rings, period 10 s, invisible at the wrap
  const logoS = t => 1 + .025 * Math.sin(ph(2, t, 0));                                                                      // breathing, 10 s
  const dotO = t => .45 + .55 * (.5 + .5 * Math.sin(ph(10, t, 0)));                                                         // live dot, 2 s
  const ghostS = t => 1 + .025 * Math.sin(ph(1, t, .25));

  const pal = (kind, n) => {   // 11 evenly spaced hues for songs (starting at saffron-orange); standby = brand colours from prototype CONFIG
    if (kind !== 'song') return { c1: '#FFA41B', c2: '#E4572E', c3: '#6b5bff', bg: '#0A0A0C' };
    const h = (30 + (n - 1) * 360 / 11) % 360, hsl = (d, s, l) => `hsl(${((h + d) % 360 + 360) % 360} ${s}% ${l}%)`;
    return { c1: hsl(0, 92, 58), c2: hsl(38, 86, 54), c3: hsl(-60, 76, 52), bg: hsl(0, 42, 5) };
  };

  const api = { P, blobPose, bar, ring, logoS, dotO, ghostS, pal, BLOBS, NB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  window.StageMath = api;

  // ---------------- DOM ----------------
  const q = new URLSearchParams(location.search), kind = q.get('kind') === 'standby' ? 'standby' : 'song';
  const n = Math.max(1, parseInt(q.get('n'), 10) || 1), $ = id => document.getElementById(id);
  const c = pal(kind, n), root = document.documentElement.style;
  root.setProperty('--c1', c.c1); root.setProperty('--c2', c.c2); root.setProperty('--c3', c.c3); root.setProperty('--bg', c.bg);
  $('lt').textContent = kind === 'song' ? `Song ${String(n).padStart(2, '0')} · Live on stage` : 'MB27 · The final chapter';
  if (kind === 'song') $('ghost').textContent = String(n).padStart(2, '0');

  const blobEls = BLOBS.map(b => {
    const e = document.createElement('i'); e.className = 'blob';
    e.style.cssText = `left:${b.x - b.w / 2}px;top:${b.y - b.h / 2}px;width:${b.w}px;height:${b.h}px;opacity:${b.o};background:radial-gradient(closest-side,var(--c${b.c}) 0,transparent 100%)`;
    $('blobs').appendChild(e); return e;
  });
  const barEls = Array.from({ length: NB }, (_, i) => {
    const e = document.createElement('i'); e.style.left = (960 - NB * 12 + i * 24 + 5) + 'px'; $('eq').appendChild(e); return e;
  });
  const rings = [...document.querySelectorAll('.ring')], tile = document.querySelector('.tile'), dot = $('dot'), ghost = $('ghost');

  function draw(t) {
    blobEls.forEach((e, i) => { const p = blobPose(i, t); e.style.transform = `translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0) scale(${p.s.toFixed(4)})`; });
    barEls.forEach((e, i) => { const b = bar(i, t); e.style.transform = `scaleY(${b.s.toFixed(4)})`; e.style.opacity = b.o.toFixed(4); });
    rings.forEach((e, k) => { const r = ring(k, t); e.style.transform = `scale(${r.s.toFixed(4)})`; e.style.opacity = r.o.toFixed(4); });
    tile.style.transform = `scale(${logoS(t).toFixed(4)})`;
    dot.style.opacity = dotO(t).toFixed(4);
    ghost.style.transform = `scale(${ghostS(t).toFixed(4)})`;
  }
  const fit = () => { $('stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener('resize', fit); fit();

  const frozen = q.has('t') ? parseFloat(q.get('t')) || 0 : null;
  if (frozen !== null) draw(frozen);
  else { draw(performance.now() / 1000); const loop = ts => { draw(ts / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }   // ts = virtual time under render/capture.js

  // API expected by render/capture.js (no cues here: render-long.js drives this page with a { state, hold } step)
  window.__ndpify = { cues: [], go() {}, idle() {} };
})();
