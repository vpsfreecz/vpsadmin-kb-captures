const { goto, preparePage, submitLast } = require('../lib/webui.cjs');

async function totpConfirmation(page) {
  await goto(page, '/?page=adminm&action=totp_devices&id=2');
  const rows = page.locator('#content-in tr', { hasText: 'Dokumentační zařízení' });
  const count = await rows.count();
  if (count > 1) throw new Error('Multiple TOTP devices use the fixture label');
  if (count === 1) {
    const remove = rows.first().locator('a[href*="action=totp_device_del"]').first();
    if ((await remove.count()) === 0) {
      throw new Error('Unable to remove the existing fixture TOTP device');
    }
    await remove.click();
    await page.waitForLoadState('domcontentloaded');
    await preparePage(page);
    const removeForm = page.locator('form[action*="action=totp_device_del"]');
    await removeForm.locator('input[name="confirm"]').check({ force: true });
    await submitLast(removeForm);
    await page.waitForLoadState('domcontentloaded');
    await preparePage(page);
  }

  await goto(page, '/?page=adminm&action=totp_device_add&id=2');
  const add = page.locator('form[action*="action=totp_device_add"]');
  await add.locator('input[name="label"]').fill('Dokumentační zařízení');
  await submitLast(add);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);
}

async function run({ page, session }) {
  await goto(page, '/?page=adminm&section=members&action=edit&id=2');
  await session.tableByText(page, 'account/email-roles', 'E-mailové role');
  await session.tableByText(page, 'account/multifactor-status', 'Dvoufaktorová autentizace');
  await session.tableByText(page, 'account/session-settings', 'Nastavení relací');

  await goto(page, '/?page=adminm&section=members&action=template_recipients&id=2');
  const recipientRows = page.locator('#content-in table').first().locator('tr');
  await session.shot(
    page,
    'account/mail-template-recipients',
    Array.from({ length: 8 }, (_value, index) => recipientRows.nth(index)),
  );

  if (session.wants('account/totp-confirm')) {
    await totpConfirmation(page);
    const form = page.locator('form[action*="action=totp_device_confirm"]');
    const sensitive = form.locator('tr', { hasText: /QR kód|Tajný klíč|QR code|Secret key/ });
    await session.locator(
      page,
      'account/totp-confirm',
      page.locator('#content-in'),
      { mask: [sensitive] },
    );
  }

  await goto(page, '/?page=adminm&action=totp_devices&id=2');
  await session.locator(page, 'account/totp-device-list', page.locator('#content-in'));

  await goto(page, '/?page=adminm&section=members&action=user_sessions&id=2');
  const table = page.locator('#content-in table').first();
  await session.shot(page, 'account/session-list', [
    page.locator('#content-in h1').first(),
    table,
  ]);
}

module.exports = { run };
