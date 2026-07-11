const {
  openRemoteConsole,
  restartFromConsole,
  send,
  setStartMenuTimeout,
  waitForConsoleText,
} = require('../lib/console.cjs');
const { goto } = require('../lib/webui.cjs');

async function captureConsole(session, page, frame, checkpoint) {
  await session.locator(
    page,
    checkpoint,
    frame.locator('#terminal .xterm-screen').first(),
    { padding: 4 },
  );
}

async function captureWebConsole(session, page, frame, checkpoint, includeSidebar = false) {
  const targets = [
    page.getByText(/Vzdálená konzole pro VPS/).first(),
    frame.locator('#terminal .xterm-screen').first(),
    frame.locator('.keyboardContainer').first(),
  ];
  if (includeSidebar) targets.push(page.locator('#aside').first());
  await session.shot(page, checkpoint, targets, { padding: 6 });
}

async function run({ fixtures, page, session }) {
  const vps = fixtures.vpsId;
  const guestBoot = /(?:[\w.-]+ login:)|OpenRC|Alpine Linux|Debian GNU\/Linux|Linux version/i;
  try {
    await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
    await session.titleAndFirstTable(page, 'console/open-web-console');
    await session.section(page, 'start-menu/vps-action', 'Start menu');
    await session.section(
      page,
      'rescue-mode/boot-form',
      'Spustit VPS ze šablony (nouzový režim)',
    );

    await setStartMenuTimeout(page, vps, 60);
    let remote = await openRemoteConsole(page, vps);
    await send(remote.frame, '\r');
    let initial = await waitForConsoleText(
      remote.frame,
      /Start Menu|emergency shell|\/ #|(?:[\w.-]+ login:)|OpenRC|Alpine Linux|Debian GNU\/Linux|Linux version/i,
    );
    if (/emergency shell|\/ #/i.test(initial)) {
      await send(remote.frame, 'exit\r');
      initial = await waitForConsoleText(remote.frame, /Start Menu/);
    }
    if (/Start Menu/.test(initial)) await send(remote.frame, 'i');
    await waitForConsoleText(remote.frame, guestBoot);
    await captureWebConsole(session, page, remote.frame, 'console/web-console');

    await restartFromConsole(page);
    await waitForConsoleText(remote.frame, /Start Menu/);
    await captureConsole(session, page, remote.frame, 'start-menu/main-menu');

    await send(remote.frame, '\u001b[B');
    await waitForConsoleText(remote.frame, /Select NixOS generation/);
    await captureConsole(session, page, remote.frame, 'start-menu/nixos-generation-action');

    await send(remote.frame, '\r');
    await waitForConsoleText(remote.frame, /Configuration 2/);
    await captureConsole(session, page, remote.frame, 'start-menu/generation-list');

    await send(remote.frame, '\u001b');
    await send(remote.frame, 'i');
    await waitForConsoleText(remote.frame, guestBoot);

    await captureWebConsole(
      session,
      page,
      remote.frame,
      'rescue-mode/vps-console-boot',
      true,
    );
  } finally {
    await setStartMenuTimeout(page, vps, 5);
    await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
    const restart = page.locator(`a[href*="run=restart"][href*="veid=${vps}"]`).first();
    if ((await restart.count()) === 0) {
      throw new Error(`Unable to restore normal boot for VPS #${vps}`);
    }
    await restart.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(12_000);
  }
}

module.exports = { run };
