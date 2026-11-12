'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const VLC_CANDIDATES = [
  'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
];

function findVlc() {
  const tryList = process.env.VLC_BIN ? [process.env.VLC_BIN] : VLC_CANDIDATES;
  return { exe: tryList.find((p) => fs.existsSync(p)) || null, tried: tryList };
}

// screen: 0-based display index (fullscreen there) or null (windowed). Single source for launch.js and the in-app switch.
function vlcArgs({ port, password, screen }) {
  return [
    '--extraintf', 'http', '--http-host', '127.0.0.1', '--http-port', String(port), '--http-password', password,
    ...(screen === null ? [] : ['--fullscreen']),
    // --no-qt-video-autoresize: stops the window resizing itself to each clip (seen as 1920x1080 -> 1936x1056 -> back)
    '--no-video-title-show', '--no-osd', '--play-and-pause', '--no-playlist-autostart', '--no-qt-video-autoresize',
    ...(screen === null ? [] : [`--qt-fullscreen-screennumber=${screen}`]),
  ];
}

// Moves the show to another display. VLC cannot change screen at runtime, so this kills the VLC that launch.js
// started (pid in vlc.pid, the same file its .bat cleans up with) and starts a new one. shortcut: Windows only.
class VlcProc {
  constructor({ dir, port, password, screen = null }) {
    this.pidFile = path.join(dir, 'vlc.pid');
    this.port = port;
    this.password = password;
    this.screen = screen; // null = windowed or unknown
  }
  canSwitch() { return fs.existsSync(this.pidFile) && !!findVlc().exe; }

  async switchTo(screen, isUp) {
    const { exe } = findVlc();
    if (!exe || !fs.existsSync(this.pidFile)) throw Object.assign(new Error('VLC was not started by launch.js, so it cannot be moved: restart with launch.js --screen N'), { status: 409 });
    const old = fs.readFileSync(this.pidFile, 'utf8').trim();
    if (/^\d+$/.test(old)) await new Promise((r) => execFile('taskkill', ['/pid', old, '/f'], () => r()));
    await new Promise((r) => setTimeout(r, 800)); // let the old VLC release its HTTP port
    const child = spawn(exe, vlcArgs({ port: this.port, password: this.password, screen }), { detached: true, stdio: 'ignore' });
    child.unref();
    fs.writeFileSync(this.pidFile, String(child.pid) + '\n');
    for (let i = 0; i < 40; i++) {
      if (await isUp()) { this.screen = screen; return; }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('new VLC did not answer on its HTTP port within 10 s');
  }
}

module.exports = { findVlc, vlcArgs, VlcProc };
