// Deterministic frame capture of prototype/index.html using CDP virtual time (30 fps, 1920x1080).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const FPS = +process.env.NDPIFY_FPS || 30, W = 1920, H = 1080;   // NDPIFY_FPS=60 for the full share video (render-full.js)
const URL = process.env.NDPIFY_URL || 'http://localhost:4000/prototype/index.html';
const PREROLL_MS = 1500; // virtual time before frame 0: lets the store window fade-in finish and assets settle

async function capture(id, def, outRoot) {
  const outDir = path.join(outRoot, id);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--run-all-compositor-stages-before-draw', '--disable-gpu-vsync', '--force-color-profile=srgb', '--hide-scrollbars'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('[page error]', e.message));
    page.on('requestfailed', r => console.error('[request failed]', r.url()));
    // no WebAudio (synthesized blips are silent in the clip anyway and AudioContext has its own clock)
    await page.addInitScript(() => {
      delete window.AudioContext; delete window.webkitAudioContext;
      // rAF is flushed by the harness once per virtual frame with performance.now() (virtual), not by the compositor's real clock
      let q = [], n = 0;
      window.requestAnimationFrame = cb => { q.push([++n, cb]); return n; };
      window.cancelAnimationFrame = i => { q = q.filter(x => x[0] !== i); };
      // CSS animations/transitions/WAAPI run on the compositor's real clock: pause each one when first seen and drive currentTime from virtual time
      const born = new WeakMap();
      window.__sync = sub => {
        const now = performance.now();
        for (const a of document.getAnimations()) {
          let t0 = born.get(a); if (t0 === undefined) { t0 = now - sub / 2; born.set(a, t0); }
          const el = now - t0, end = a.effect.getComputedTiming().endTime;
          if (el >= end) a.finish(); else { a.pause(); a.currentTime = el; }
        }
      };
      window.__flushRaf = () => { const c = q; q = []; const t = performance.now(); c.forEach(x => x[1](t)); };
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });

    const FRAME_MS = 1000 / FPS;
    let frame = 0, vt = 0; // vt: virtual ms elapsed
    // def.range = [from, to): only frames from..to-1 of the timeline are saved. Earlier frames are still stepped (state stays identical) but not screenshotted, so a long segment can be split across machines.
    let tl = 0; const [R0, R1] = def.range || [0, Infinity], STOP = new Error('range end');
    const SUB = FRAME_MS / 4; // sub-steps keep animation start times within ~4 ms of the real virtual moment
    const sub = async ms => {
      const done = new Promise(res => cdp.once('Emulation.virtualTimeBudgetExpired', res));
      await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: ms });
      await done; vt += ms;
      await page.evaluate(s => window.__sync && window.__sync(s), SUB).catch(() => {});
    };
    const step = async ms => { for (let left = ms; left > 1e-6; left -= SUB) await sub(Math.min(SUB, left)); };
    const grab = async () => {
      if (tl < R0) { tl++; return; }
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, String(++frame).padStart(5, '0') + '.png'), Buffer.from(data, 'base64'));
      if (++tl >= R1) throw STOP;
    };
    // advance one frame of virtual time, then screenshot
    const tick = async () => { await step(FRAME_MS); await page.evaluate(() => { window.__flushRaf(); window.__sync(0); }); await grab(); };

    // paused virtual time blocks the load event: commit, then step virtual time until the document is complete
    await page.goto(URL, { waitUntil: 'commit' });
    for (let i = 0; i < 200 && (await page.evaluate(() => document.readyState).catch(() => '')) !== 'complete'; i++) await step(50);
    // assets: fonts + every <img> (also ones inserted later) must be decoded before frame 0
    for (let i = 0; i < 40; i++) {
      const ok = await page.evaluate(async () => { await document.fonts.ready; return [...document.images].every(im => im.complete); });
      if (ok) break;
      await step(100);
    }
    await step(PREROLL_MS);

    // wrap every cue's run() so the harness knows when the cue's promise resolves
    await page.evaluate(() => {
      window.__done = 0;
      window.__ndpify.cues.forEach(c => { const o = c.run; c.run = async function () { try { return await o.call(this); } finally { window.__done++; } }; });
    });

    try {
    for (const s of def.steps) {
      if (s.state) { await page.evaluate(n => window.__ndpify.idle(n), s.state); for (let n = 0; n < Math.round(s.hold * FPS); n++) await tick(); continue; }   // idle state: blur | reveal, then hold
      const before = await page.evaluate(() => window.__done);
      await page.evaluate(i => window.__ndpify.go(i, 1), s.cue);
      if (s.idle) { for (let n = 0; n < Math.round(s.idle * FPS); n++) await tick(); continue; }
      // frame 0 of the first cue is the state right after prep(); later steps continue seamlessly
      let guard = 0;
      do { await tick(); if (++guard > 60 * FPS) throw new Error(`cue ${s.cue} did not finish in 60 s of virtual time`); }
      while ((await page.evaluate(() => window.__done)) === before);
    }
    for (let n = 0; n < Math.round(def.tail * FPS); n++) await tick();
    } catch (e) { if (e !== STOP) throw e; }
    return { frames: frame, seconds: frame / FPS, dir: outDir };
  } finally { await browser.close(); }
}
module.exports = { capture, FPS, W, H };
if (require.main === module) {
  const id = process.argv[2], { clips } = require('./clips');
  capture(id, clips[id], path.join(__dirname, 'frames')).then(r => console.log(r), e => { console.error(e); process.exit(1); });
}
