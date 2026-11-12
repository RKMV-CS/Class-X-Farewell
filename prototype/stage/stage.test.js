// node prototype/stage/stage.test.js : every motion repeats after 20 s (seamless loop), 11 distinct song palettes
const S = require('./stage.js'), a = require('assert'), near = (x, y) => a(Math.abs(x - y) < 1e-6);
for (const t of [0, 1.37, 7.77, 13.3, 19.99]) {
  const u = t + S.P;
  S.BLOBS.forEach((_, i) => { const p = S.blobPose(i, t), q = S.blobPose(i, u); near(p.x, q.x); near(p.y, q.y); near(p.s, q.s); });
  for (let i = 0; i < S.NB; i++) { const p = S.bar(i, t), q = S.bar(i, u); near(p.s, q.s); near(p.o, q.o); }
  [0, 1].forEach(k => { const p = S.ring(k, t), q = S.ring(k, u); near(p.s, q.s); near(p.o, q.o); });
  near(S.logoS(t), S.logoS(u)); near(S.dotO(t), S.dotO(u)); near(S.ghostS(t), S.ghostS(u));
}
a.equal(new Set(Array.from({ length: 11 }, (_, i) => S.pal('song', i + 1).c1)).size, 11);
console.log('stage ok');
