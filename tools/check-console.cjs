const assert = require('assert');

const { canonicalGuestConsole } = require('../lib/console.cjs');
const { DEFAULT_OS_TEMPLATE } = require('../lib/webui.cjs');

assert.strictEqual(DEFAULT_OS_TEMPLATE, 'Debian (latest)');

const raw = [
  '[    0.123456] boot timing that must not be captured',
  'Debian GNU/Linux 13 vps console',
  '',
  'vps login:',
].join('\n');

assert.strictEqual(
  canonicalGuestConsole(raw),
  [
    'Debian GNU/Linux 13 vps console',
    '',
    'vps login:',
  ].join('\n'),
);

assert.strictEqual(
  canonicalGuestConsole('vps login:', 'Debian GNU/Linux 13 vps console'),
  [
    'Debian GNU/Linux 13 vps console',
    '',
    'vps login:',
  ].join('\n'),
);

assert.throws(
  () => canonicalGuestConsole('vps login:', 'Ubuntu 26.04 vps console'),
  /Invalid Debian console banner/,
);
