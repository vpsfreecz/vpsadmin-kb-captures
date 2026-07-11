const assert = require('assert');

const { canonicalGuestConsole } = require('../lib/console.cjs');

const raw = [
  '[    0.123456] boot timing that must not be captured',
  'Welcome to Alpine Linux 3.24',
  'Kernel 6.12.95 on x86_64 (/dev/console)',
  '',
  'vps login:',
].join('\n');

assert.strictEqual(
  canonicalGuestConsole(raw),
  [
    'Welcome to Alpine Linux 3.24',
    'Kernel 6.12.95 on x86_64 (/dev/console)',
    '',
    'vps login:',
  ].join('\n'),
);
