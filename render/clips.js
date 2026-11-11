// Clip definition table. Adding clip 04..11 = one more line here.
// step forms: { cue: n } | { cue: n, idle: sec } | { state: 'blur'|'reveal', hold: sec } (prototype idle state, then idle `hold` s).
// id = file name in controller/cues.json (without .mp4); steps = cues to run in order;
// hold = seconds to idle after that cue's run() resolves (or, for cue with idle:true, to idle INSTEAD of waiting);
// tail = seconds held after the last cue finishes. audio = optional file (wav/mp3) muxed into the clip; sfx:true = synthesize it from audio.js EVENTS[id].
module.exports = {
  approved: ['01_store_download', '02_ndpify_open', '03_home_trending', '04_library_playlist', '06_adbreak_intro'],
  clips: {
    '01_store_download': { steps: [{ cue: 1 }], tail: 0.5, sfx: true },   // starts on the held sharp App Store frame (cue 0 == that frame); Face ID check runs inside cue 1
    '00_idle_blur':      { steps: [{ state: 'blur', hold: 3 }], tail: 0 },      // NOT approved yet: blurred waiting frame (prototype idle('blur'))
    '00_store_idle':     { steps: [{ state: 'reveal', hold: 4 }], tail: 0 },    // NOT approved yet: blur -> sharp, then held (idle('reveal'))
    '02_ndpify_open':    { steps: [{ cue: 2 }], tail: 0.5, sfx: true },
    '03_home_trending':  { steps: [{ cue: 3 }], tail: 0.5, sfx: true },
    '04_library_playlist': { steps: [{ cue: 4 }], tail: 0.5, sfx: true },
    '06_adbreak_intro':  { steps: [{ cue: 6 }], tail: 0.5, sfx: true },
    // Guess Who (inside the ad break): cue index = 8 + 3*(k-1) guess (10 s timer, ends HELD on the mystery frame), +1 reveal (ends HELD on the real face), +2 dismiss. NOT approved yet, not rendered.
    '12_gw1_guess': { steps: [{ cue: 8 }], tail: 0.5 },
    '13_gw1_reveal': { steps: [{ cue: 9 }], tail: 0.5 },
    '14_gw1_off': { steps: [{ cue: 10 }], tail: 0.5 },
    '15_gw2_guess': { steps: [{ cue: 11 }], tail: 0.5 },
    '16_gw2_reveal': { steps: [{ cue: 12 }], tail: 0.5 },
    '17_gw2_off': { steps: [{ cue: 13 }], tail: 0.5 },
    '18_gw3_guess': { steps: [{ cue: 14 }], tail: 0.5 },
    '19_gw3_reveal': { steps: [{ cue: 15 }], tail: 0.5 },
    '20_gw3_off': { steps: [{ cue: 16 }], tail: 0.5 },
    '21_gw4_guess': { steps: [{ cue: 17 }], tail: 0.5 },
    '22_gw4_reveal': { steps: [{ cue: 18 }], tail: 0.5 },
    '23_gw4_off': { steps: [{ cue: 19 }], tail: 0.5 },
    '24_gw5_guess': { steps: [{ cue: 20 }], tail: 0.5 },
    '25_gw5_reveal': { steps: [{ cue: 21 }], tail: 0.5 },
    '26_gw5_off': { steps: [{ cue: 22 }], tail: 0.5 },
    '27_gw6_guess': { steps: [{ cue: 23 }], tail: 0.5 },
    '28_gw6_reveal': { steps: [{ cue: 24 }], tail: 0.5 },
    '29_gw6_off': { steps: [{ cue: 25 }], tail: 0.5 },
    '30_gw7_guess': { steps: [{ cue: 26 }], tail: 0.5 },
    '31_gw7_reveal': { steps: [{ cue: 27 }], tail: 0.5 },
    '32_gw7_off': { steps: [{ cue: 28 }], tail: 0.5 },
    '33_gw8_guess': { steps: [{ cue: 29 }], tail: 0.5 },
    '34_gw8_reveal': { steps: [{ cue: 30 }], tail: 0.5 },
    '35_gw8_off': { steps: [{ cue: 31 }], tail: 0.5 },
  },
};
