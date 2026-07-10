const {
  goto,
  preparePage,
  submitLast,
  walkCloneVps,
  walkCreateVps,
} = require('../lib/webui.cjs');

async function run({ fixtures, page, session }) {
  await walkCreateVps(page);
  await page.locator('input[name="hostname"]').fill('kb-cs-playground-preview');
  await session.locator(page, 'playground/create-vps-form', page.locator('#content-in'));

  await walkCloneVps(page, fixtures.vpsId);
  await session.locator(page, 'playground/clone-vps-form', page.locator('#content-in'));

  await goto(page, `/?page=adminvps&action=swap&veid=${fixtures.vpsId}`);
  await session.locator(page, 'playground/swap-vps-action', page.locator('#content-in'));

  if (session.wants('playground/swap-vps-preview')) {
    const form = page.locator('form').filter({ has: page.locator('select, input[type="radio"]') }).first();
    const select = form.locator('select').first();
    if ((await select.count()) > 0) {
      const value = String(fixtures.secondVpsId);
      await select.selectOption(value).catch(async () => {
        await select.selectOption({ index: 1 });
      });
    } else {
      const radio = form.locator(`input[type="radio"][value="${fixtures.secondVpsId}"]`).first();
      if ((await radio.count()) > 0) await radio.check({ force: true });
    }
    await submitLast(form);
    await page.waitForLoadState('domcontentloaded');
    await preparePage(page);
    await session.locator(page, 'playground/swap-vps-preview', page.locator('#content-in'));
  }
}

module.exports = { run };
