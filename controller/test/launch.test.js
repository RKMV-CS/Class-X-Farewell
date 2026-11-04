'use strict';
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const { findFreePort } = require('../launch');

// Port 0 gives an OS-chosen port, so the test never collides with the show's real ports.
function hold(host) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, host, () => resolve(srv));
  });
}

test('findFreePort skips a port held on 127.0.0.1', async () => {
  const srv = await hold('127.0.0.1');
  const busy = srv.address().port;
  try {
    const free = await findFreePort(busy);
    assert.ok(free > busy, `expected a port above ${busy}, got ${free}`);
  } finally {
    srv.close();
  }
});

test('findFreePort treats a port bound only on 0.0.0.0 as busy', async () => {
  const srv = await hold('0.0.0.0');
  const busy = srv.address().port;
  try {
    const free = await findFreePort(busy);
    assert.ok(free > busy, `expected a port above ${busy}, got ${free}`);
  } finally {
    srv.close();
  }
});
