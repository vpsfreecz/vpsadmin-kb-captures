const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { exact, normalizeDynamicValues, preparePage } = require('./webui.cjs');

function sanitizeUrl(raw) {
  const url = new URL(raw);
  if (url.protocol === 'about:') return 'about:blank';
  for (const name of ['code', 'session', 'state', 't', 'token']) {
    url.searchParams.delete(name);
  }
  return `${url.pathname}${url.search}`;
}

async function unionBox(locators, padding = 8) {
  const boxes = [];
  for (const locator of locators) {
    const target = locator.first();
    await target.waitFor({ state: 'visible' });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (box) boxes.push(box);
  }
  if (boxes.length === 0) throw new Error('Capture target has no bounding box');

  const left = Math.max(0, Math.min(...boxes.map((box) => box.x)) - padding);
  const top = Math.max(0, Math.min(...boxes.map((box) => box.y)) - padding);
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + padding;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

class CaptureSession {
  constructor({ assets, checkpoint, language, repoRoot, scenario }) {
    this.assets = assets.filter((asset) =>
      asset.language === language &&
      (!scenario || asset.scenario === scenario) &&
      (!checkpoint || `${asset.scenario}/${asset.checkpoint}` === checkpoint ||
        asset.checkpoint === checkpoint),
    );
    this.repoRoot = repoRoot;
    this.results = [];
    this.seen = new Set();
  }

  wants(checkpoint) {
    return this.assets.some((asset) => asset.checkpoint === checkpoint);
  }

  asset(checkpoint) {
    const matches = this.assets.filter((asset) => asset.checkpoint === checkpoint);
    if (matches.length !== 1) {
      throw new Error(`${checkpoint}: expected one inventory entry, found ${matches.length}`);
    }
    if (this.seen.has(checkpoint)) {
      throw new Error(`${checkpoint}: checkpoint was captured more than once`);
    }
    return matches[0];
  }

  async shot(page, checkpoint, locators, options = {}) {
    if (!this.wants(checkpoint)) return;
    const asset = this.asset(checkpoint);
    const output = path.join(this.repoRoot, asset.output);
    if (asset.review_status !== 'pending' && fs.existsSync(output)) {
      throw new Error(
        `${asset.id}: ${asset.review_status} capture cannot be overwritten`,
      );
    }
    await preparePage(page);
    await normalizeDynamicValues(page);
    const targets = Array.isArray(locators) ? locators : [locators];
    const clip = options.clip || await unionBox(targets, options.padding);
    fs.mkdirSync(path.dirname(output), { recursive: true });

    await page.screenshot({
      path: output,
      clip,
      mask: options.mask || [],
      maskColor: '#d8dee9',
    });

    const contents = fs.readFileSync(output);
    this.seen.add(checkpoint);
    this.results.push({
      id: asset.id,
      checkpoint,
      driver: asset.driver,
      output: asset.output,
      page: sanitizeUrl(page.url()),
      sha256: crypto.createHash('sha256').update(contents).digest('hex'),
    });
  }

  async locator(page, checkpoint, locator, options = {}) {
    await this.shot(page, checkpoint, locator, options);
  }

  async section(page, checkpoint, headingText, options = {}) {
    if (!this.wants(checkpoint)) return;
    const heading = page.locator('#content-in h2', { hasText: exact(headingText) }).first();
    const content = heading.locator('xpath=following-sibling::*[1]');
    await this.shot(page, checkpoint, [heading, content], options);
  }

  async titleAndFirstTable(page, checkpoint, options = {}) {
    await this.shot(page, checkpoint, [
      page.locator('#content-in h1').first(),
      page.locator('#content-in table').first(),
    ], options);
  }

  async tableByText(page, checkpoint, text, options = {}) {
    await this.locator(
      page,
      checkpoint,
      page.locator('#content-in table', { hasText: text }).first(),
      options,
    );
  }

  finish() {
    const missing = this.assets
      .map((asset) => asset.checkpoint)
      .filter((checkpoint) => !this.seen.has(checkpoint));
    if (missing.length > 0) {
      throw new Error(`Missing checkpoints: ${missing.join(', ')}`);
    }
    const target = path.join(this.repoRoot, 'tmp/capture-results.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(this.results, null, 2)}\n`);
    return this.results;
  }
}

module.exports = { CaptureSession, sanitizeUrl };
