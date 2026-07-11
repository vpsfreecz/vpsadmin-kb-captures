const { goto, preparePage, submitLast } = require('./webui.cjs');

async function setStartMenuTimeout(page, vpsId, timeout) {
  await goto(page, `/?page=adminvps&action=info&veid=${vpsId}`);
  const form = page.locator(`form[action*="action=startmenu"][action*="veid=${vpsId}"]`);
  await form.locator('input[name="timeout"]').fill(String(timeout));
  await submitLast(form);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);
  await page.waitForTimeout(4_000);
}

async function openRemoteConsole(page, vpsId) {
  await goto(page, `/?page=adminvps&action=info&veid=${vpsId}`);
  const link = page.locator(`a[href*="page=console"][href*="veid=${vpsId}"]`).first();
  const href = await link.getAttribute('href');
  if (!href) throw new Error(`No remote-console link found for VPS #${vpsId}`);
  await goto(page, new URL(href, page.url()).href);
  const iframe = page.locator('#vpsadmin-console-frame');
  await iframe.waitFor({ state: 'visible' });
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  await frame.locator('#terminal .xterm-screen').waitFor({ state: 'visible', timeout: 60_000 });
  return { frame, iframe };
}

async function consoleText(frame) {
  return frame.locator('#terminal .xterm-rows').innerText();
}

function canonicalGuestConsole(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const findLast = (pattern, label) => {
    const line = lines.findLast((candidate) => pattern.test(candidate));
    if (!line) throw new Error(`Console is missing ${label}: ${text}`);
    return line.trimStart();
  };
  return [
    findLast(/^Welcome to Alpine Linux\b/, 'the Alpine welcome line'),
    findLast(/^Kernel \S+ on (?:an? )?\S+ \(.+\)$/, 'the Alpine kernel line'),
    '',
    findLast(/^vps login:/, 'the fixture login prompt'),
  ].join('\n');
}

async function normalizeGuestConsole(frame) {
  const output = canonicalGuestConsole(await consoleText(frame));
  await frame.evaluate((value) => new Promise((resolve) => {
    clearTimeout(window.remoteConsole.timeout);
    window.remoteConsole.term.reset();
    window.remoteConsole.term.write(
      `\u001b[2J\u001b[H${value.replaceAll('\n', '\r\n')}`,
      () => {
        window.remoteConsole.term.refresh(0, window.remoteConsole.term.rows - 1);
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      },
    );
  }), output);
}

async function send(frame, data) {
  await frame.evaluate((value) => { window.remoteConsole.pendingData += value; }, data);
  await frame.waitForTimeout(350);
}

async function waitForConsoleText(frame, pattern, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = await consoleText(frame);
    if (pattern.test(text)) return text;
    await frame.waitForTimeout(500);
  }
  throw new Error(`Console did not show ${pattern}: ${text}`);
}

async function restartFromConsole(page) {
  const iframe = page.locator('#vpsadmin-console-frame');
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  await frame.evaluate(() => {
    window.remoteConsole.term.clear();
    window.remoteConsole.term.reset();
  });
  await page.evaluate(() => window.vps_do('restart'));
  await page.waitForTimeout(1_500);
}

module.exports = {
  canonicalGuestConsole,
  consoleText,
  normalizeGuestConsole,
  openRemoteConsole,
  restartFromConsole,
  send,
  setStartMenuTimeout,
  waitForConsoleText,
};
