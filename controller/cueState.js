'use strict';
const CLIP_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.m4v'];

// Shared by the constructor and setCues(): every cue needs id/file/label/mode, ids are unique, and a file is a bare
// name inside clips/ (no folders) with a known video extension.
function validateCues(cues) {
  if (!Array.isArray(cues) || cues.length === 0) throw new Error('cues must be a non-empty array');
  const seen = new Set();
  cues.forEach((c, i) => {
    if (!c || !c.id || !c.file || !c.label) throw new Error(`cue #${i} needs id, file, label`);
    if (c.mode !== 'hold' && c.mode !== 'loop') throw new Error(`cue ${c.id}: mode must be "hold" or "loop"`);
    if (seen.has(c.id)) throw new Error(`duplicate cue id ${c.id}`);
    seen.add(c.id);
    if (typeof c.file !== 'string' || /[\\/\0]/.test(c.file) || c.file.startsWith('.')) throw new Error(`cue ${c.id}: file must be a plain file name`);
    if (!CLIP_EXTS.includes(c.file.slice(c.file.lastIndexOf('.')).toLowerCase())) throw new Error(`cue ${c.id}: file extension must be one of ${CLIP_EXTS.join(' ')}`);
  });
}

// Pure cue state machine (no I/O). index -1 = show not started (nothing playing).
class CueState {
  constructor(cues) {
    validateCues(cues);
    this.cues = cues;
    this.index = -1;
    this.rev = 0; // bumps on every sequence edit so dashboards know to reload the list
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
  // Swap in an edited sequence. The playing cue stays current (matched by id), so reordering never changes what is on
  // screen; an edit that drops the playing cue is refused. Throws and changes nothing on any problem.
  setCues(list) {
    validateCues(list);
    const cur = this.current;
    let index = -1;
    if (cur) {
      index = list.findIndex((c) => c.id === cur.id);
      if (index < 0) throw Object.assign(new Error('the cue that is playing cannot be removed: jump to another cue first'), { status: 409 });
    }
    this.cues = list;
    this.index = index;
    this.rev++;
  }
  snapshot() {
    return {
      index: this.index,
      total: this.cues.length,
      rev: this.rev,
      current: this.current && { id: this.current.id, label: this.current.label, mode: this.current.mode },
      next: this.next && { id: this.next.id, label: this.next.label, mode: this.next.mode },
      finished: this.index === this.cues.length - 1,
    };
  }
}
module.exports = { CueState, validateCues, CLIP_EXTS };
