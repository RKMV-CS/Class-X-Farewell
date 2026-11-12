// Definitions for the long (17 min) ambient / ad clips. Driver: render-long.js. cue = index in prototype/index.html `cues` (0-based).
// Only ONE loop period is captured; every infinite animation must divide `period`, otherwise the loop jumps.
// Two kinds: `cue` loops capture a prototype cue (np1, ad; the prototype is never edited: render-long.js serves a patched copy
// /prototype/loops.html with PAGE_PATCH appended) and `page` loops capture a standalone page (prototype/stage/, a pure function of time with a 20 s period).
const songs = {};
for (let n = 2; n <= 11; n++) { const k = 'song' + String(n).padStart(2, '0'); songs[k] = { page: `stage/index.html?kind=song&n=${n}`, period: 20, files: [k] }; }   // song01 = np1
module.exports = {
  TARGET_S: 1020,   // 17:00
  SETTLE_S: 2,      // idle after the entry transition so no one-off transition is left inside the loop
  loops: {
    np1: { cue: 5, period: 60, files: ['05_nowplaying_song1'] },                    // Library -> Now playing (song 1)
    ad:  { cue: 7, period: 30, files: ['07_ad_video', '08_continuing_ad'] },        // Get Pro -> placeholder ad (08 = same file)
    standby: { page: 'stage/index.html?kind=standby', period: 20, files: ['standby'] },   // live-act standby ("MB27 - the final chapter")
    ...songs,                                                                       // song02 .. song11: one palette per song
  },
  // Original animation periods (2x duration for `alternate`): glows 14/18 s, label 10, cover 12, rings 6, 44 EQ bars 2.6-6 s (random),
  // ad drift 24/30, blink 1.6. Snapped to divisors of the period (60 s now playing, 30 s ad); changes are <= ~10 %, invisible.
  PAGE_PATCH: `<style>
.g1{animation-duration:7.5s!important}.g2{animation-duration:10s!important}
.ad-ph i:nth-child(1){animation-duration:15s!important}.ad-chip i{animation-duration:1.5s!important}
</style><script>
document.querySelectorAll('.np-eq i').forEach(function (i) {
  var d = parseFloat(i.style.getPropertyValue('--dur')), k = Math.round(60 / (2 * d));   // alternate period 2d -> 60/k
  i.style.setProperty('--dur', (30 / k) + 's');
});
</script>`,
};
