'use strict';
// Pure cue state machine (no I/O). index -1 = show not started (nothing playing).
class CueState {
  constructor(cues) {
    if (!Array.isArray(cues) || cues.length === 0) throw new Error('cues must be a non-empty array');
    cues.forEach((c, i) => {
      if (!c.id || !c.file || !c.label) throw new Error(`cue #${i} needs id, file, label`);
      if (c.mode !== 'hold' && c.mode !== 'loop') throw new Error(`cue ${c.id}: mode must be "hold" or "loop"`);
    });
    this.cues = cues;
    this.index = -1;
  }
  get current() { return this.index >= 0 ? this.cues[this.index] : null; }
  get next() { return this.cues[this.index + 1] || null; }
  // Each mutator returns the cue to play, or null if nothing should change.
  advance() { if (this.index >= this.cues.length - 1) return null; this.index++; return this.current; }
  back() { if (this.index <= 0) return null; this.index--; return this.current; }
  replay() { return this.current; }
  jump(n) { // 1-based as typed by the operator
    const i = n - 1;
    if (!Number.isInteger(i) || i < 0 || i >= this.cues.length) return null;
    this.index = i;
    return this.current;
  }
  snapshot() {
    return {
      index: this.index,
      total: this.cues.length,
      current: this.current && { id: this.current.id, label: this.current.label, mode: this.current.mode },
      next: this.next && { id: this.next.id, label: this.next.label, mode: this.next.mode },
      finished: this.index === this.cues.length - 1,
    };
  }
}
module.exports = { CueState };
