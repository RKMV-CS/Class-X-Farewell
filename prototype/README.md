# NDPify prototype

Open `index.html` in Chrome/Edge (no server, no network needed). Press `F` for fullscreen. The 1920x1080 stage scales to fit any window. Press any cue key once first so the browser allows audio.

Edit `CONFIG` and `songs[]` at the top of the `<script>` in `index.html` (names, colours, ad video/poster paths, song covers via the `cover` image path).

## Keys
Space / Right = next cue, Left = replay previous cue, 1-7 = jump to scene, F = fullscreen, H = show/hide cue indicator, T = reveal song title on Now Playing (hidden by default).

## Cue list
| Cue | Scene | What happens |
|---|---|---|
| idle i1 / i2 | 0 Idle | `__ndpify.idle('blur')` static blurred App Store (clip 00_idle_blur, held until start); `idle('reveal')` 1.4 s focus-pull to the sharp held frame (clip 00_store_idle). Space: blur, reveal, then cue 2 (cue 1 below == the held frame) |
| 1 | 1 Store | NDPify page with Install button (the sharp idle frame, identical to the end of idle reveal) |
| 2 | 1 Store | Cursor clicks Install, progress bar, done, fade to black |
| 3 | 2 Desktop | Fade in, cursor clicks NDPify icon, app zooms open to splash |
| 4 | 3 Home | Splash dissolves into Home (Trending songs) |
| 5 | 4 Library | Cursor to Library, playlist slides in, click, tracklist |
| 6 | 5 Now playing | Cursor hits Play, ambient state (no title, no timer), loops forever |
| 7 | 6 Ad break | Pro explanation, cursor clicks Get Pro with ripple + synth sting |
| 8 | 7 Ad playing | "Continuing ad" (video slot or placeholder) |
| 9 | 5 Now playing | Next song (songs[1], ...), ambient loop |
| 10 | 6 Ad break | repeat |
| 11 | 7 Ad playing | repeat; next cue loops back to cue 9 with the next song |
