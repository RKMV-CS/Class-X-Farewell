'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Windows-only (PowerShell + System.Windows.Forms). shortcut: other OSes get an empty list / error, port when the show runs on macOS.
// Parameters travel in env vars, never in the script text, so nothing user-controlled is interpolated.
const HEAD = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Dpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
[Dpi]::SetProcessDPIAware() | Out-Null
`;
const LIST = HEAD + `
$i = 0
$r = foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
  [pscustomobject]@{ index = $i; name = $s.DeviceName; primary = $s.Primary; x = $s.Bounds.X; y = $s.Bounds.Y; width = $s.Bounds.Width; height = $s.Bounds.Height }
  $i++
}
ConvertTo-Json -InputObject @($r) -Compress
`;
const SHOT = HEAD + `
$b = [System.Windows.Forms.Screen]::AllScreens[[int]$env:NDP_IDX].Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$h = [int]($b.Height * 800 / $b.Width)
$t = New-Object System.Drawing.Bitmap $bmp, 800, $h
$t.Save($env:NDP_OUT, [System.Drawing.Imaging.ImageFormat]::Jpeg)
`;

function ps(script, env) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(new Error('displays: Windows only'));
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { env: { ...process.env, ...env }, timeout: 8000, windowsHide: true },
      (err, stdout, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout)));
  });
}

let cache = { at: 0, value: null };
async function list() {
  if (cache.value && Date.now() - cache.at < 5000) return cache.value;
  const value = JSON.parse(await ps(LIST, {}));
  cache = { at: Date.now(), value };
  return value;
}

// One capture at a time: a slow PowerShell must not pile up behind a fast-polling dashboard.
let inflight = null;
async function capture(index) {
  if (!Number.isInteger(index) || index < 0) throw new Error('bad display index');
  if (inflight) return inflight;
  const out = path.join(os.tmpdir(), `ndpify-shot-${process.pid}.jpg`);
  inflight = ps(SHOT, { NDP_IDX: String(index), NDP_OUT: out })
    .then(() => fs.promises.readFile(out))
    .finally(() => { inflight = null; });
  return inflight;
}

module.exports = { list, capture };
