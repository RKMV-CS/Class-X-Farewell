'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

// Thin client for VLC's HTTP interface (requests/status.json).
// Auth: HTTP Basic with EMPTY username and the --http-password as password.
// Command names used (from VLC docs / memory, see README "uncertainty"):
//   in_play&input=<mrl>   play an MRL immediately (and add to playlist)
//   pl_pause              TOGGLE pause/resume
//   pl_stop               stop
//   pl_repeat             TOGGLE repeat-current-item   (status.json field "repeat")
//   pl_loop               TOGGLE loop-whole-playlist   (status.json field "loop")
class Vlc {
  constructor({ host = '127.0.0.1', port = 8080, password = 'farewell', clipsDir, log = console.log } = {}) {
    this.base = `http://${host}:${port}/requests/status.json`;
    this.auth = 'Basic ' + Buffer.from(':' + password).toString('base64');
    this.clipsDir = clipsDir;
    this.log = log;
  }
  async raw(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(qs ? `${this.base}?${qs}` : this.base, {
      headers: { Authorization: this.auth },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`VLC HTTP ${res.status}`);
    return res.json();
  }
  status() { return this.raw(); }
  command(command, extra = {}) { return this.raw({ command, ...extra }); }

  async setRepeat(want) {
    // pl_repeat is a toggle, so read state first and only toggle on mismatch.
    let st = await this.status();
    if (!!st.repeat === want) return st;
    st = await this.command('pl_repeat');
    return st;
  }
  async setLoopPlaylistOff() {
    const st = await this.status();
    return st.loop ? this.command('pl_loop') : st;
  }

  async playCue(cue) {
    const abs = path.resolve(this.clipsDir, cue.file);
    const mrl = pathToFileURL(abs).href;
    await this.setLoopPlaylistOff();
    // No pl_empty: it stops playback, VLC tears down the video window and the projector flashes white
    // (measured: 46-240 ms "stopped" gap per switch). The new item is appended after the old ones, so
    // nothing is queued behind it and --play-and-pause never advances into a stale item.
    await this.command('in_play', { input: mrl });
    // "loop" = repeat current item; "hold" relies on VLC --play-and-pause
    // (freezes on last frame at end) and repeat OFF.
    await this.setRepeat(cue.mode === 'loop');
  }
  // Seek to 0 and resume: used when --play-and-pause parks a loop cue at its end.
  async restart() {
    await this.command('seek', { val: '0' });
    return this.command('pl_play');
  }
  togglePause() { return this.command('pl_pause'); }
  toggleFullscreen() { return this.command('fullscreen'); }
  stop() { return this.command('pl_stop'); }
}
module.exports = { Vlc };
