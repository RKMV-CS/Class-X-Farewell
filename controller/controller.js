'use strict';
const { CueState } = require('./cueState');

// Orchestrates state + VLC + debounce + logging. Same entry point for keyboard and phone.
class Controller {
  constructor({ cues, vlc, debounceMs = 300, log = (m) => console.log(m), now = () => Date.now() }) {
    this.state = new CueState(cues);
    this.vlc = vlc;
    this.debounceMs = debounceMs;
    this.log = log;
    this.now = now;
    this.last = -Infinity;
    this.lastError = null;
    this.userPaused = false;
  }
  ts() { return new Date(this.now()).toISOString().slice(11, 23); }

  // action: next | prev | replay | pause | jump (arg = 1-based number)
  async handle(action, source = '?', arg) {
    const t = this.now();
    if (t - this.last < this.debounceMs) {
      this.log(`[${this.ts()}] ignored "${action}" from ${source} (debounce ${t - this.last}ms)`);
      return { ok: false, reason: 'debounced', ...this.snapshot() };
    }
    this.last = t;
    const before = this.state.index;
    let cue = null;
    let pauseOnly = false;
    switch (action) {
      case 'next': cue = this.state.advance(); break;
      case 'prev': cue = this.state.back(); break;
      case 'replay': cue = this.state.replay(); break;
      case 'jump': cue = this.state.jump(Number(arg)); break;
      case 'pause': pauseOnly = true; break;
      default: return { ok: false, reason: 'unknown action', ...this.snapshot() };
    }
    try {
      if (pauseOnly) {
        await this.vlc.togglePause();
        this.userPaused = !this.userPaused;
        this.log(`[${this.ts()}] ${source}: pause/resume toggled`);
      } else if (!cue) {
        this.log(`[${this.ts()}] ${source}: "${action}" has no effect (at index ${before})`);
        return { ok: false, reason: 'no-op', ...this.snapshot() };
      } else {
        const n = this.state.index + 1;
        this.log(`[${this.ts()}] ${source}: ${action} -> cue ${n}/${this.state.cues.length} ${cue.id} [${cue.mode}] "${cue.label}"`);
        await this.vlc.playCue(cue);
        this.userPaused = false;
      }
      this.lastError = null;
      return { ok: true, ...this.snapshot() };
    } catch (e) {
      this.lastError = e.message;
      this.log(`[${this.ts()}] VLC ERROR on "${action}": ${e.message} (state index now ${this.state.index})`);
      return { ok: false, reason: 'vlc-error: ' + e.message, ...this.snapshot() };
    }
  }
  snapshot() { return { state: this.state.snapshot(), error: this.lastError }; }

  // VLC's --play-and-pause beats "repeat", so a loop cue parks paused at its end. Restart it
  // unless the operator paused on purpose. Call from a timer; never throws.
  async tick() {
    const cue = this.state.current;
    if (!cue || cue.mode !== 'loop' || this.userPaused) return;
    try {
      const st = await this.vlc.status();
      if (st.state === 'paused' && st.length > 0 && st.time >= st.length - 1) {
        await this.vlc.restart();
        this.log(`[${this.ts()}] loop: restarted ${cue.id}`);
      }
    } catch (e) { /* VLC unreachable: handle() already reports that to the operator */ }
  }
}
module.exports = { Controller };
