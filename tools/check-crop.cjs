const assert = require('assert');
const { chromium } = require('playwright');

const { chromiumExecutable } = require('../lib/browser.cjs');
const { unionBox } = require('../lib/capture-session.cjs');

const close = (actual, expected, message) => {
  assert(Math.abs(actual - expected) <= 1, `${message}: ${actual} != ${expected}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`<!doctype html><style>
      body { margin: 0; }
      #wide { box-sizing: border-box; margin: 30px 0 0 40px; width: 700px; }
      table { border: 2px solid black; border-collapse: collapse; width: 240px; }
      td { border: 1px solid black; padding: 4px; }
      h1 { box-sizing: border-box; height: 40px; margin: 30px 0 0 40px;
           padding-top: 5px; width: 700px; font: 24px/30px sans-serif; }
      iframe { display: block; box-sizing: border-box; margin: 10px 0 0 40px;
               border: 2px solid black; width: 700px; height: 120px; }
    </style><div id="wide"><table><tr><td>short</td><td>value</td></tr></table></div>
    <h1>Complete heading</h1><iframe title="Console"></iframe>`);

    const wide = page.locator('#wide');
    const table = page.locator('table');
    const tableBox = await table.boundingBox();
    const wideBox = await wide.boundingBox();
    const tableClip = await unionBox([wide], 8);
    close(tableClip.x, tableBox.x - 8, 'left table margin');
    close(tableClip.x + tableClip.width, tableBox.x + tableBox.width + 8,
      'right table margin');
    assert(tableClip.width < wideBox.width, 'unused parent width was included');

    const heading = page.locator('h1');
    const headingBox = await heading.boundingBox();
    const headingClip = await unionBox([heading], 8);
    close(headingClip.y, headingBox.y - 8, 'heading top margin');
    close(headingClip.y + headingClip.height, headingBox.y + headingBox.height + 8,
      'heading bottom margin');
    assert(headingClip.width < headingBox.width, 'unused heading width was included');

    const frame = page.locator('iframe');
    const frameBox = await frame.boundingBox();
    const consoleClip = await unionBox([heading, frame], 8);
    close(consoleClip.y, headingBox.y - 8, 'console heading top margin');
    close(consoleClip.x, frameBox.x - 8, 'console frame left margin');
    close(consoleClip.x + consoleClip.width, frameBox.x + frameBox.width + 8,
      'console frame right margin');
    close(consoleClip.y + consoleClip.height, frameBox.y + frameBox.height + 8,
      'console frame bottom margin');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
