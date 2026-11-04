// Definitions for the long (17 min) ambient / ad clips. Driver: render-long.js. cue = index in prototype/index.html `cues` (0-based).
// Only ONE loop period is captured; every infinite CSS animation must divide `period`, otherwise the loop jumps.
// The prototype is never edited: render-long.js serves a patched copy (/prototype/loops.html) with PAGE_PATCH appended.
module.exports = {
  TARGET_S: 1020,   // 17:00
  SETTLE_S: 2,      // idle after the entry transition so no one-off transition is left inside the loop
  loops: {
    np1: { cue: 5, period: 60, files: ['05_nowplaying_song1'] },                                  // Library -> Now playing (song 1)
    np2: { cue: 29, period: 60, files: ['09_nowplaying_song2'] },                                  // Guess Who -> Now playing (song 2); cue 29 = 8 + 3 x 7 students (shifts with the student count)
    ad:  { cue: 7, period: 30, files: ['07_ad_video', '08_continuing_ad', '11_extra_video_2'] },  // Get Pro -> placeholder ad (08/11 = same file)
  },
  short: { c10: { cue: 30, file: '10_extra_video_1', tail: 0.5 } },                                // Ad break again (same timeline as clip 06)
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
