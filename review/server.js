// Review hub: serves prototype + hub UI on LAN, live-reloads on file change, stores approvals.
// No auth: private network only. Run: node review/server.js [port]
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), PORT = +process.argv[2] || 4000;
const STATE = path.join(__dirname, 'state.json');
const watched = [path.join(ROOT, 'prototype', 'index.html'), path.join(__dirname, 'hub.html')];
const mtime = () => Math.max(...watched.map(f => fs.statSync(f).mtimeMs));
const read = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = u.pathname;
  if (p === '/__mtime') return res.end(String(mtime()));
  if (p === '/__state' && req.method === 'GET') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(read())); }
  if (p === '/__state' && req.method === 'POST') {
    let b = ''; req.on('data', d => (b += d)); req.on('end', () => {
      try { fs.writeFileSync(STATE, JSON.stringify(JSON.parse(b), null, 2)); res.end('ok'); } catch { res.statusCode = 400; res.end('bad'); }
    }); return;
  }
  if (p === '/') p = '/review/hub.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(path.join(ROOT, 'prototype')) && !f.startsWith(__dirname)) { res.statusCode = 404; return res.end('nope'); }
  if (path.basename(f) === 'state.json') { res.statusCode = 404; return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.setHeader('cache-control', 'no-store'); res.end(d);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${PORT}`);
  console.log('Review hub:\n  ' + ips.join('\n  '));
});
