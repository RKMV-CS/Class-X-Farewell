// node render/collect-clips.test.js
const a = require('assert'), { controllerName: c, studentCount, plan } = require('./collect-clips');
a.equal(c('009_gw1_mystery'), '12_gw1_guess');
a.equal(c('010_gw1_reveal'), '13_gw1_reveal');
a.equal(c('011_gw1_dismiss'), '14_gw1_off');
a.equal(c('012_gw2_mystery'), '15_gw2_guess');
a.equal(c('047_gw13_dismiss'), '50_gw13_off');
a.equal(c('000_idle_blur'), null);
a.equal(c('048_nextsong'), null);
a.equal(studentCount([{ id: '05_nowplaying_song1' }, { id: '12_gw1_guess' }, { id: '13_gw1_reveal' }, { id: '15_gw2_guess' }]), 2);
const ids = ['000_idle_blur', '009_gw1_mystery', '010_gw1_reveal', '011_gw1_dismiss', '012_gw2_mystery', '013_gw2_reveal', '014_gw2_dismiss', '015_gw3_mystery'];
let p = plan(ids, 2);
a.deepEqual(p.missing, []);
a.equal(p.renames.length, 6);
a.deepEqual(p.skipped, ['000_idle_blur', '015_gw3_mystery']);   // kid 3 is not in cues.json: ignored
p = plan(ids, 3);
a.deepEqual(p.missing, ['19_gw3_reveal', '20_gw3_off']);
const { SCENES, sceneParts } = require('./collect-clips');
const segs = ['000_idle_blur.mp4', '001_store_open.mp4', '003c_open.mp4', '003a_open.mp4', '003b_open.mp4', '005_library.mp4', '006_nowplaying.mp4'];
a.deepEqual(sceneParts(segs, SCENES['02_ndpify_open']), ['003a_open.mp4', '003b_open.mp4', '003c_open.mp4']);   // slices joined in order
a.deepEqual(sceneParts(segs, SCENES['04_library_playlist']), ['005_library.mp4']);
a.deepEqual(sceneParts(segs, SCENES['00_idle_blur']), ['000_idle_blur.mp4']);
a.deepEqual(sceneParts(segs, { segs: ['006'] }), ['006_nowplaying.mp4']);
console.log('collect-clips ok');
