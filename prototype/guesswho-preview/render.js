// node render.js          -> key frames in keys/
// node render.js --mp4    -> also renders every frame at 30 fps and encodes guesswho-preview.mp4 (bundled ffmpeg)
// Time is driven by window.setT(t), so every frame is exact (same idea as hello-preview/render.js).
const { chromium } = require('../../render/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const DIR = __dirname, FFMPEG = path.join(DIR, '../../render/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const FPS = 30, mp4 = process.argv.includes('--mp4');
(async () => {
  const br = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('console', m => console.log('[page]', m.text())); pg.on('pageerror', e => console.log('[err]', e.message));
  await pg.goto('file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/') + '?shot=1');
  await pg.evaluate(() => window.READY);
  const I = await pg.evaluate(() => window.GUESSWHO_INFO);
  console.log('total', I.T.toFixed(2), 's, round', I.ROUND.toFixed(2), 's, starts', I.starts.map(x => +x.toFixed(2)).join(','));
  fs.mkdirSync(path.join(DIR, 'keys'), { recursive: true });
  const k = [['first', 0], ['r1_mystery_early', I.starts[0] + 1.6], ['r1_mystery_late', I.starts[0] + I.tFlip - .3], ['r1_flip_a', I.starts[0] + I.tFlip + .3], ['r1_flip_b', I.starts[0] + I.tFlip + .8],
    ['r1_reveal', I.starts[0] + I.tExit - .3], ['r2_mystery', I.starts[1] + I.tFlip - .5], ['r2_reveal', I.starts[1] + I.tExit - .3],
    ['r3_reveal', I.starts[2] + I.tExit - .3], ['r4_mystery', I.starts[3] + I.tFlip - .5], ['r4_reveal', I.starts[3] + I.tExit - .3], ['last', I.T]];
  for (const [n, t] of k) { await pg.evaluate(t => setT(t), t); await pg.screenshot({ path: path.join(DIR, 'keys', `${n}.png`) }); }
  if (mp4) {
    const fr = path.join(DIR, '_frames'); fs.rmSync(fr, { recursive: true, force: true }); fs.mkdirSync(fr);
    const n = Math.round(I.T * FPS) + 1;
    for (let i = 0; i < n; i++) { await pg.evaluate(t => setT(t), i / FPS); await pg.screenshot({ path: path.join(fr, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 }); }
    const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(fr, '%05d.jpg'), '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', path.join(DIR, 'guesswho-preview.mp4')], { encoding: 'utf8' });
    console.log(r.status === 0 ? `mp4 ok (${n} frames, ${(n / FPS).toFixed(1)} s)` : 'ffmpeg failed: ' + r.stderr);
    fs.rmSync(fr, { recursive: true, force: true });
  }
  await br.close();
})();
