const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const { chromiumExecutable } = require('../lib/browser.cjs');

for (const family of ['Courier New', 'Courier', 'Liberation Mono']) {
  const match = execFileSync('fc-match', ['--format=%{family}\n', family], {
    encoding: 'utf8',
  }).trim();
  assert.match(match, /Liberation Mono/, `${family} resolves to ${match}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const widths = await page.evaluate(async () => {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = '14px "Liberation Mono"';
      return [context.measureText('iiiiiiii').width, context.measureText('WWWWWWWW').width];
    });
    assert(Math.abs(widths[0] - widths[1]) < 0.01, `font is not monospaced: ${widths}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
