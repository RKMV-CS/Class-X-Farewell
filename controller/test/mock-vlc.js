'use strict';
// Minimal fake of VLC's status.json: records commands, tracks repeat/loop toggles.
const http = require('http');
function start(port = 0, password = 'farewell') {
  const calls = [];
  const st = { state: 'stopped', repeat: false, loop: false };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.headers.authorization !== 'Basic ' + Buffer.from(':' + password).toString('base64')) { res.writeHead(401); return res.end(); }
    const cmd = u.searchParams.get('command');
    if (cmd) {
      calls.push({ command: cmd, input: u.searchParams.get('input') });
      if (cmd === 'in_play') st.state = 'playing';
      if (cmd === 'pl_repeat') st.repeat = !st.repeat;
      if (cmd === 'pl_loop') st.loop = !st.loop;
      if (cmd === 'pl_pause') st.state = st.state === 'paused' ? 'playing' : 'paused';
      if (cmd === 'pl_stop') st.state = 'stopped';
      if (cmd === 'seek') st.time = Number(u.searchParams.get('val'));
      if (cmd === 'pl_play') st.state = 'playing';
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(st));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, calls, st, port: server.address().port })));
}
module.exports = { start };
