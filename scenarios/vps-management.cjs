const { goto, walkCreateVps } = require('../lib/webui.cjs');
const { label } = require('../lib/i18n.cjs');

async function run({ fixtures, language, page, session }) {
  await walkCreateVps(page);
  await session.locator(page, 'vps-management/create-vps-form', page.locator('#content-in'));

  await goto(page, `/?page=adminvps&action=info&veid=${fixtures.vpsId}`);
  await session.section(
    page,
    'vps-management/set-root-password',
    label(language, 'rootPassword'),
  );
  await session.section(page, 'vps-management/reinstall-form', label(language, 'reinstallSystem'));
  await session.section(page, 'vps-management/resource-settings', label(language, 'resources'));
  await session.section(page, 'vps-management/hostname-form', 'Hostname');
  await session.documentationSection(
    page,
    'vps-management/feature-settings',
    'vps.features',
  );
  await session.section(page, 'vps-management/outage-windows', label(language, 'maintenanceWindows'));
  const features = page.locator('[data-vpsadmin-doc-id="vps.features"]').first();
  await session.locator(
    page,
    'vps-details/feature-settings',
    features.locator('xpath=following-sibling::*[1]'),
  );
  const datasets = page.locator('#content-in h2', {
    hasText: new RegExp(`^\\s*${label(language, 'datasets')}\\s*$`),
  }).first();
  const mounts = page.locator('#content-in h2', {
    hasText: new RegExp(`^\\s*${label(language, 'mounts')}\\s*$`),
  }).first();
  await session.shot(page, 'vps-details/datasets', [
    datasets,
    datasets.locator('xpath=following-sibling::*[1]'),
    mounts,
    mounts.locator('xpath=following-sibling::*[1]'),
  ]);
  await session.section(page, 'userns/map', label(language, 'uidGidMapping'));
}

module.exports = { run };
