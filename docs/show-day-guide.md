# Show-day guide (no coding needed)

For the person who sits at the laptop and presses NEXT. Read it once a week before, and once more the day before.

## 1. How the show works in one minute

- The whole show is a list of **video clips** in a fixed order. You move through the list with **NEXT**.
- The laptop plays each clip with **VLC** on the projector. Kids perform live; you decide when the next clip starts. Nothing is tied to a clock.
- Two kinds of clips:
  - **hold**: plays once, then freezes on its last picture and waits for you (intros, videos, Guess Who).
  - **loop**: repeats by itself until you press NEXT (songs, announcements, ads that run while something happens live).
- Every clip starts where the last one ended, so the cuts look smooth. Pressing NEXT twice quickly is ignored on purpose (so a double tap cannot skip a clip).

## 2. What you need

| Item | Notes |
|---|---|
| Stage laptop | Windows, plugged into power. Sleep, screen saver and notifications **off**. |
| Projector + HDMI cable | Laptop set to **Extend** the screen (Win + P, then "Extend"). Sound goes through HDMI. |
| The show folder | On the laptop's own disk (not a USB stick, not a cloud-synced folder). Contains the 74 clips. |
| Presentation clicker | It sends Page Down / Page Up. Works only while the controller window is in front. |
| Your phone | On the same Wi-Fi as the laptop. A phone hotspot works. |
| A second laptop | Same folder, same clips, same software, tested. Keep it ready. |
| Printed cue list | The table in section 6. |

Software on the laptop: **VLC**, **Node.js** (version 18 or newer). Nothing else.

## 3. Before the day (checklist)

- [ ] All clips are in `controller/clips/` on the laptop's local disk.
- [ ] Ask your tech helper to run `node launch.js --dry-run` in the `controller` folder. It must say all clips are present and nothing is missing.
- [ ] Do a **full run-through on the real projector** with the real clips, including the loops and the phone.
- [ ] Check the **sound level** through the hall speakers using a student video.
- [ ] Check the clicker works (press it, the cue should move).
- [ ] Copy the folder to the backup laptop and test it there too.
- [ ] Rehearse with the kids and the printed cue list at least once.

## 4. Starting the show software

1. Plug in the projector and set the laptop to **Extend**.
2. Open the show folder, then the `controller` folder. In the address bar type `cmd` and press Enter (a black window opens in that folder).
3. Type `node launch.js` and press Enter.
4. A new console window opens and VLC starts. The console prints a web address and a **QR code**.
5. On the laptop, open `http://localhost:3000` in a browser: this is the **dashboard**. The port can differ if 3000 is busy; use the address the console prints.
6. In the dashboard, choose the **projector screen** from the screen picker (and press **Recheck screens** after plugging the projector in). Press **FULLSCREEN** so the clip fills the projector.
7. Nothing plays until you press NEXT for the first time. The first cue is the welcome announcement.

On the phone: scan the QR code (or type the address). You get the same big buttons.

## 5. Controls

| What | Keyboard (controller window in front) | Dashboard / phone |
|---|---|---|
| Next clip | Space, Right arrow, Page Down (clicker) | **NEXT** |
| Previous clip | Left arrow, Page Up | **PREV** |
| Replay this clip | R | **REPLAY** |
| Pause / resume | P | **PAUSE** |
| Quit | Q | close the console window |
| Jump to a cue | number keys 1-9 | tap a cue in the list **twice** (the second tap confirms) |

The dashboard shows the current and next cue, a live preview of the projector, and "HELD AT END" when a hold clip has finished and is waiting for you.

**Golden rule: always look at what the dashboard says is NEXT before you press.**

## 6. The run of the show

The numbers match the "Sequence" sheet. Cue labels in the dashboard start with the same number.

| Row | What the audience sees | Your presses |
|---|---|---|
| 1 | Welcome announcement (looping screen) | NEXT when the announcement ends |
| 2-3 | Netflix-style intro, then the "MB27 Presents / The Final Chapter" card (it stays on screen) | NEXT to continue |
| 4 | NDPify starts: blurred waiting screen, app store, install, desktop, home, library, playlist | NEXT after each step (6 presses) |
| 5, 6 | Song 1 and Song 2 (calm "now playing" screen, loops while the kids sing) | NEXT when the song ends |
| 7 | Act 1: ad break intro, then a looping "Continuing ad" screen while the live act performs | NEXT, then NEXT when the act ends |
| 8, 9 | Song 3 and Song 4 | NEXT after each |
| 10 | Act 2 ad break (intro, ad, continuing ad), then **Guess Who** | see below |
| 11, 12 | Song 5 and Song 6 | NEXT after each |
| 13-14 | "First Steps" video + Junior section video | NEXT to start, NEXT after |
| 15, 16 | Song 7 and Song 8 | NEXT after each |
| 17 | Class tours: Class VIII, IX, X (three videos) | NEXT between them |
| 18-20 | Songs 9, 10, 11 | NEXT after each |
| 21 | Farewell edit: part 1 ("From getting our 1st ID cards..."), then part 2 (Last School) | NEXT between them |
| 22 | Closing announcement (looping screen) | NEXT when ready |
| 23 | Finale: "Every Story Has an Ending" | the end |

**Guess Who (14 kids).** Each kid is **three presses**:
1. NEXT -> the childhood photo appears with a countdown (6, 8 or 10 seconds depending on the number of photos) and **freezes** for the audience to guess.
2. NEXT -> the reveal (today's photo and the name) stays on screen.
3. NEXT -> the card goes away, ready for the next kid.

Fourteen kids x 3 = 42 presses, so go calmly and watch the NEXT label.

The exact list of all 74 cues is `controller/cues.json`; the dashboard shows it in order.

## 7. If something goes wrong

| Problem | What to do |
|---|---|
| Projector shows the wrong screen or a small window | In the dashboard pick the projector in the screen picker, press **Recheck screens**, then **FULLSCREEN**. |
| Black screen between clips | Normal for a split second only. If it stays black, press **REPLAY**. |
| You pressed NEXT too early | Press **PREV**, then NEXT when ready. Or tap the cue you want twice in the list. |
| Clicker does nothing | Click on the controller console window so it is in front, or use the phone/dashboard. |
| Phone cannot connect | Same Wi-Fi? Use the laptop dashboard. Phone hotspot is a good backup network. |
| VLC window closed | Close the console window, run `node launch.js` again, tap the cue you need twice, FULLSCREEN. |
| Everything frozen | Switch to the backup laptop (it should already be at the same cue: tap the cue number twice). |
| Sound missing | Check the laptop's HDMI sound output and the volume. Student videos have sound; scene clips mostly do not. |

Do not click around in VLC itself and do not close its window. Leave the console window open for the whole show.

## 8. After the show

Press **Q** in the console window. VLC closes by itself. Copy the folder somewhere safe if the school wants a record, but remember: it contains the students' photos and videos, so do not post it publicly.
