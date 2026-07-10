const { goto } = require('../lib/webui.cjs');

async function run({ fixtures, page, session }) {
  const vps = fixtures.vpsId;
  const dataset = fixtures.datasetId;

  await goto(page, `/?page=adminvps&action=info&veid=${vps}`);
  await session.section(page, 'datasets/vps-dataset-list', 'Datasety');
  await session.section(page, 'datasets/mount-list', 'Mounty');

  await goto(page, `/?page=dataset&action=new&role=hypervisor&parent=${dataset}`);
  await session.locator(page, 'datasets/create-dataset-form', page.locator('#content-in'));

  await goto(page, `/?page=dataset&action=mount&dataset=${dataset}&vps=${vps}`);
  await session.locator(page, 'datasets/mount-dataset-form', page.locator('#content-in'));

  await goto(page, '/?page=nas');
  await session.locator(page, 'exports/nas-export-list', page.locator('#content-in'));

  await goto(page, '/?page=backup&action=vps');
  await session.locator(page, 'exports/backup-export-list', page.locator('#content-in'));
  await session.locator(
    page,
    'restore-backups/backup-list',
    page.locator('#content-in table').first(),
  );
  await session.titleAndFirstTable(page, 'backups/vps-backups');

  const exportRoute = fixtures.snapshot?.exportCreateRoute ||
    `/?page=export&action=create&dataset=${dataset}`;
  await goto(page, exportRoute);
  await session.locator(page, 'exports/create-export-form', page.locator('#content-in'));
  await session.locator(
    page,
    'restore-backups/mount-backup-form',
    page.locator('#content-in form').first(),
  );

  await page.locator('.advanced-option-toggle').click();
  await session.locator(page, 'exports/export-details', page.locator('#content-in'));

  await goto(page, '/?page=adminvps&action=list');
  await session.titleAndFirstTable(page, 'restore-backups/playground-vps-list');
}

module.exports = { run };
