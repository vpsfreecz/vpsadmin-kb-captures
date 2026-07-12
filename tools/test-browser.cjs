const assert = require('assert');
const net = require('net');
const { once } = require('events');

const { closeServer, startProxy } = require('../lib/browser.cjs');

async function main() {
  const proxy = await startProxy({ network: 'local' });
  const socket = net.connect(proxy.address().port, '127.0.0.1');
  await once(socket, 'connect');
  const socketClosed = once(socket, 'close');

  await Promise.race([
    closeServer(proxy),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('proxy teardown timed out with an open tunnel')),
      1_000,
    )),
  ]);

  await socketClosed;
  assert.strictEqual(socket.destroyed, true);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
