const { goto } = require('../lib/webui.cjs');

async function run({ fixtures, page, session }) {
  const vps = fixtures.vpsId;

  await goto(page, '/?page=adminm');
  await session.titleAndFirstTable(page, 'getting-started/members-list');

  await goto(page, '/?page=adminvps&action=list');
  await session.titleAndFirstTable(page, 'getting-started/vps-list');

  await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
  await session.titleAndFirstTable(page, 'getting-started/vps-details');
  await session.section(page, 'getting-started/ssh-connection', 'SSH připojení');
  await session.section(
    page,
    'getting-started/deploy-public-key',
    'Nahrát veřejný klíč do /root/.ssh/authorized_keys',
  );
  await goto(page, '/?page=adminm&action=pubkey_add&id=2');
  await session.locator(
    page,
    'ssh-keys/add-public-key',
    page.locator('#content-in').first(),
  );

  await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
  await session.locator(
    page,
    'ssh-keys/deploy-public-key',
    page.locator('form', { hasText: 'Dokumentační klíč' }).first(),
  );
}

module.exports = { run };
