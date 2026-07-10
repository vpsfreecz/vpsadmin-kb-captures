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
  consoleText,
  openRemoteConsole,
  restartFromConsole,
  send,
  setStartMenuTimeout,
  waitForConsoleText,
};
