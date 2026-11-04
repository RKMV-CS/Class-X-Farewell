// node render.js            -> static.png (finished word) + frames at key times in keys/
// node render.js --mp4      -> also renders every frame at 30 fps and encodes hello-preview.mp4 (bundled ffmpeg)
const { chromium } = require('../../render/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const DIR = __dirname, FFMPEG = path.join(DIR, '../../render/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const FPS = 30, mp4 = process.argv.includes('--mp4');
(async () => {
  const br = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('console', m => console.log('[page]', m.text())); pg.on('pageerror', e => console.log('[err]', e.message));
  await pg.goto('file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/') + '?shot=0');
  const info = await pg.evaluate(() => window.HELLO);
  console.log('plan', JSON.stringify(info.plan.map(s => [+s.s.toFixed(2), +s.d.toFixed(2)])), 'writeEnd', info.T_WRITE_END.toFixed(2));
  const end = info.T_WRITE_END + 2.6;
  fs.mkdirSync(path.join(DIR, 'keys'), { recursive: true });
  await pg.evaluate(() => setT(99)); await pg.screenshot({ path: path.join(DIR, 'static.png') });
  const keys = [0.2, ...info.plan.map(s => s.s + s.d * .55), info.T_WRITE_END + .1, info.T_WRITE_END + .9, end];
  for (const [i, t] of keys.entries()) { await pg.evaluate(t => setT(t), t); await pg.screenshot({ path: path.join(DIR, 'keys', `k${i}_${t.toFixed(2)}.png`) }); }
  if (mp4) {
    const fr = path.join(DIR, '_frames'); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
    const n = Math.ceil(end * FPS);
    for (let i = 0; i < n; i++) { await pg.evaluate(t => setT(t), i / FPS); await pg.screenshot({ path: path.join(fr, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 }); }
    const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(fr, '%05d.jpg'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-movflags', '+faststart', path.join(DIR, 'hello-preview.mp4')], { encoding: 'utf8' });
    console.log(r.status === 0 ? `mp4 ok (${n} frames, ${(n / FPS).toFixed(1)} s)` : 'ffmpeg failed: ' + r.stderr);
    fs.rmSync(fr, { recursive: true, force: true });
  }
  await br.close();
})();
