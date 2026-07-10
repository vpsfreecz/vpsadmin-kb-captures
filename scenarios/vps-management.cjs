const { goto, walkCreateVps } = require('../lib/webui.cjs');

async function run({ fixtures, page, session }) {
  await walkCreateVps(page);
  await session.locator(page, 'vps-management/create-vps-form', page.locator('#content-in'));

  await goto(page, `/?page=adminvps&action=info&veid=${fixtures.vpsId}`);
  await session.section(
    page,
    'vps-management/set-root-password',
    'Nastavit heslo uživatele root (ve VPS, ne ve vpsAdminu)',
  );
  await session.section(page, 'vps-management/reinstall-form', 'Přeinstalovat systém');
  await session.section(page, 'vps-management/resource-settings', 'Zdroje');
  await session.section(page, 'vps-management/hostname-form', 'Hostname');
  await session.section(page, 'vps-management/feature-settings', 'Funkce');
  await session.section(page, 'vps-management/outage-windows', 'Okna údržby');
  const features = page.locator('#content-in h2', { hasText: /^\s*Funkce\s*$/ }).first();
  await session.locator(
    page,
    'vps-details/feature-settings',
    features.locator('xpath=following-sibling::*[1]'),
  );
  await session.section(page, 'vps-details/datasets', 'Datasety');
  await session.section(page, 'userns/map', 'UID/GID mapování');
}

module.exports = { run };
