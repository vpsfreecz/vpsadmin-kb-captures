const assert = require('assert');

const { sanitizeUrl } = require('../lib/capture-session.cjs');

assert.strictEqual(
  sanitizeUrl('https://example.test/?page=adminm&action=totp_device_confirm&id=2&dev=17'),
  '/?page=adminm&action=totp_device_confirm&id=2',
);
