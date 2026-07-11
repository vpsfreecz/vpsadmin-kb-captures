const assert = require('assert');

const { canonicalMonitorTranscript } = require('../lib/terminal.cjs');

function firstScreenLine(transcript, columns = 100) {
  const screen = Array(columns).fill(' ');
  let column = 0;
  let row = 0;
  for (let index = 0; index < transcript.length;) {
    if (transcript[index] === '\u001b' && transcript[index + 1] === '[') {
      const match = transcript.slice(index).match(/^\u001b\[([0-9;?]*)([A-Za-z])/);
      if (match) {
        const values = match[1].replace(/^\?/, '').split(';').filter(Boolean).map(Number);
        if (match[2] === 'H' || match[2] === 'f') {
          row = (values[0] || 1) - 1;
          column = (values[1] || 1) - 1;
        } else if (match[2] === 'G') {
          column = (values[0] || 1) - 1;
        }
        index += match[0].length;
        continue;
      }
    }
    if (transcript[index] === '\u001b') {
      index += transcript[index + 1] === '(' ? 3 : 2;
      continue;
    }
    if (transcript[index] === '\r') {
      column = 0;
    } else if (transcript[index] === '\n') {
      row += 1;
    } else if (transcript.charCodeAt(index) >= 32) {
      if (row === 0 && column < columns) screen[column] = transcript[index];
      column += 1;
    }
    index += 1;
  }
  return screen.join('').trimEnd();
}

const raw = [
  '\u001b[H\u001b[2J',
  'vpsfreectl network top - 20:00:42, next update at 20:00:52',
  '\u001b[4;8H\u001b[39;49m\u001b(B\u001b[m1 venet0',
  '\nSession terminated, killing shell...',
].join('');
const canonical = canonicalMonitorTranscript(raw, 1, 'venet0');

assert(!canonical.includes('Session terminated'));
assert.strictEqual(
  firstScreenLine(canonical),
  'vpsfreectl network top - 12:00:00, next update at 12:00:10',
);
