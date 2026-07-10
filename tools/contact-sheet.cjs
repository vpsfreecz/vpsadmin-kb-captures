#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const { chromiumExecutable } = require('../lib/browser.cjs');

const repoRoot = path.resolve(__dirname, '..');
const group = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'captures.json')));
const assets = manifest.assets.filter((asset) =>
  !group || asset.topic === group || asset.scenario === group);
if (assets.length === 0) throw new Error(`No assets match topic or scenario ${group}`);

async function main() {
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    const cards = assets.map((asset) => ({
      id: asset.id,
      image: `data:image/png;base64,${fs.readFileSync(path.join(repoRoot, asset.output)).toString('base64')}`,
    }));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 20px; background: #dfe4ea; font: 15px sans-serif; }
      main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      article { background: white; border: 1px solid #aab2bd; padding: 10px; }
      h2 { margin: 0 0 8px; font: 600 15px monospace; }
      img { display: block; width: 100%; height: 300px; object-fit: contain; object-position: top left; }
    </style></head><body><main id="cards"></main></body></html>`);
    await page.locator('#cards').evaluate((container, items) => {
      for (const item of items) {
        const card = document.createElement('article');
        const title = document.createElement('h2');
        title.textContent = item.id;
        const image = document.createElement('img');
        image.src = item.image;
        card.append(title, image);
        container.append(card);
      }
    }, cards);
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await page.screenshot({
      path: path.join(repoRoot, 'tmp', `contact-sheet-${group || 'all'}.png`),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
