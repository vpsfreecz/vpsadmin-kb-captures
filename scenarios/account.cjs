const { goto, preparePage, submitLast } = require('../lib/webui.cjs');
const { fixturesFor, label } = require('../lib/i18n.cjs');

async function totpConfirmation(page, language) {
  const deviceLabel = fixturesFor(language).totpDevice;
  await goto(page, '/?page=adminm&action=totp_devices&id=2');
  const rows = page.locator('#content-in tr', { hasText: deviceLabel });
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
  await add.locator('input[name="label"]').fill(deviceLabel);
  await submitLast(add);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);
}

async function run({ language, page, session }) {
  await goto(page, '/?page=adminm&section=members&action=edit&id=2');
  await session.tableByText(page, 'account/email-roles', label(language, 'emailRoles'));
  await session.tableByText(page, 'account/multifactor-status', label(language, 'multifactorStatus'));
  await session.tableByText(page, 'account/session-settings', label(language, 'sessionSettings'));

  await goto(page, '/?page=adminm&section=members&action=template_recipients&id=2');
  const recipientRows = page.locator('#content-in table').first().locator('tr');
  await session.shot(
    page,
    'account/mail-template-recipients',
    Array.from({ length: 8 }, (_value, index) => recipientRows.nth(index)),
  );

  if (session.wants('account/totp-confirm')) {
    await totpConfirmation(page, language);
    const form = page.locator('form[action*="action=totp_device_confirm"]');
    await form.evaluate((element) => {
      for (const input of element.querySelectorAll('input[type="hidden"]')) {
        if (/secret|otp|totp|uri/i.test(`${input.name} ${input.id}`)) input.value = '';
      }
      for (const row of element.querySelectorAll('tr')) {
        const label = row.cells[0]?.textContent.trim() || '';
        if (/QR kód|QR code/i.test(label)) {
          for (const link of row.querySelectorAll('a')) link.removeAttribute('href');
          for (const image of row.querySelectorAll('img, canvas, svg')) image.remove();
          const placeholder = document.createElement('div');
          placeholder.setAttribute('aria-label', 'Bezpečná ukázka QR kódu');
          placeholder.style.cssText = [
            'width:176px',
            'height:176px',
            'border:12px solid white',
            'outline:1px solid #777',
            'background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0/22px 22px',
            'box-shadow:inset 0 0 0 48px rgba(255,255,255,.72)',
          ].join(';');
          row.cells[1]?.appendChild(placeholder);
        }
        if (/Tajný klíč|Secret key/i.test(label) && row.cells[1]) {
          row.cells[1].textContent = '•••• •••• •••• ••••';
        }
      }
    });
    await session.locator(
      page,
      'account/totp-confirm',
      page.locator('#content-in'),
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
