const { renderTerminal, runTrafficMonitor } = require('../lib/terminal.cjs');
const { goto } = require('../lib/webui.cjs');

async function run({ cluster, fixtures, page, proxyUrl, repoRoot, session }) {
  const vps = fixtures.vpsId;

  await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
  await session.locator(
    page,
    'traffic/vps-monthly-transfers',
    page.locator('form', { hasText: 'Přenosy za' }).first(),
  );
  await session.locator(
    page,
    'networking/routed-addresses',
    page.locator('form', { hasText: 'Routované adresy' }).first(),
  );
  await session.locator(
    page,
    'networking/interface-addresses',
    page.locator('form', { hasText: 'Adresy rozhraní' }).first(),
  );
  const reverseHref = await page.locator(
    'a[href*="page=networking"][href*="action=hostaddr_ptr"]',
  ).first().getAttribute('href');
  if (!reverseHref) throw new Error('No reverse-record action is available for the fixture VPS');
  await goto(page, reverseHref);
  await session.locator(
    page,
    'reverse-dns/configure-reverse-record',
    page.locator('#content-in'),
  );

  await goto(page, '/?page=networking&action=ip_addresses');
  await session.locator(page, 'networking/ip-address-list', page.locator('#content-in'));

  await goto(page, '/?page=networking&action=traffic');
  await session.locator(page, 'traffic/monthly-traffic', page.locator('#content-in'));

  await goto(page, '/?page=networking&action=live');
  await session.locator(page, 'traffic/live-monitor-web', page.locator('#content-in'));

  if (session.wants('traffic/live-monitor-cli')) {
    const output = await runTrafficMonitor({ cluster, fixtures, proxyUrl, repoRoot });
    const terminal = await page.context().newPage();
    try {
      await renderTerminal(terminal, 'vpsfreectl network top', output);
      await session.locator(
        terminal,
        'traffic/live-monitor-cli',
        terminal.locator('#terminal'),
        { padding: 12 },
      );
    } finally {
      await terminal.close();
    }
  }
}

module.exports = { run };
