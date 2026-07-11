function exact(text) {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

async function preparePage(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
}

async function normalizeDynamicValues(page) {
  await page.evaluate(() => {
    const normalize = (value) => value
      .replace(/\b20\d{2}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\b/g, '2025-01-15 12:00:00')
      .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '2025-01-15')
      .replace(/\b20\d{2}\/(?:[1-9]|1[0-2])\b/g, '2025/1')
      .replace(/\b\d{1,2}\.\s*\d{1,2}\.\s*20\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\b/g,
        '15. 1. 2025 12:00:00');

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) continue;
      node.nodeValue = normalize(node.nodeValue);
    }

    for (const input of document.querySelectorAll('input[type="text"], input:not([type])')) {
      input.value = normalize(input.value);
    }

    const rowValues = new Map([
      ['Uptime', ['00:20:08']],
      ['Loadavg', ['0.08, 0.04, 0.00']],
      ['Procesy', ['5']],
      ['CPU', ['3,02 %']],
      ['Přijato', ['1,22 KiB', '19']],
      ['Odesláno', ['290,57 KiB', '3,05k']],
      ['Celkem', ['291,79 KiB', '3,07k']],
    ]);
    for (const row of document.querySelectorAll('tr')) {
      if (row.querySelector('input, select, textarea, button')) continue;
      const cells = Array.from(row.cells);
      const label = cells[0]?.textContent.trim().replace(/:$/, '');
      const values = rowValues.get(label);
      if (!values) continue;
      values.forEach((value, index) => {
        if (cells[index + 1]) cells[index + 1].textContent = value;
      });
    }

    for (const select of document.querySelectorAll('select')) {
      const identity = `${select.name} ${select.id}`.toLowerCase();
      const selected = select.selectedOptions[0];
      if (!selected) continue;
      if (/year|rok/.test(identity)) selected.textContent = '2025';
      if (/month|mesic|měsíc/.test(identity)) selected.textContent = '1';
    }
  });
}

async function goto(page, route) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await preparePage(page);
}

async function submitLast(form) {
  const buttons = form.locator(
    'input[type="submit"], button[type="submit"], button:not([type])',
  );
  const count = await buttons.count();
  if (count === 0) {
    throw new Error('No submit button found');
  }
  await buttons.nth(count - 1).click();
}

async function selectFirstRadio(form, name) {
  const radios = form.locator(
    `input[type="radio"][name="${name}"]:not([disabled])`,
  );
  if ((await radios.count()) === 0) {
    throw new Error(`No usable ${name} radio found`);
  }
  await radios.first().check({ force: true });
}

async function selectRadioByRowText(form, name, text) {
  const row = form.getByText(text, { exact: true }).first().locator('xpath=ancestor::tr[1]');
  const radio = row.locator(`input[type="radio"][name="${name}"]:not([disabled])`).first();
  if ((await radio.count()) === 0) {
    throw new Error(`No usable ${name} radio found for ${text}`);
  }
  await radio.check({ force: true });
}

async function selectFirstOption(select) {
  const options = await select.locator('option').evaluateAll((elements) =>
    elements.map((option) => ({
      disabled: option.disabled,
      label: option.textContent.trim(),
      value: option.value,
    })),
  );
  const option = options.find((candidate) =>
    !candidate.disabled
      && candidate.value !== ''
      && candidate.value !== '0'
      && candidate.label !== '-------',
  );
  if (!option) {
    throw new Error('No usable select option found');
  }
  await select.selectOption(option.value);
  return option;
}

async function walkCreateVps(
  page,
  { environmentLabel = 'Production', locationLabel = 'Praha' } = {},
) {
  await goto(page, '/?page=adminvps&action=new-step-1');
  const environmentForm = page.locator('form[name="newvps-step1"]');
  if ((await environmentForm.count()) > 0) {
    await selectRadioByRowText(environmentForm, 'environment', environmentLabel);
    await submitLast(environmentForm);
    await page.waitForLoadState('domcontentloaded');
    await preparePage(page);
  }
  let form = page.locator('form[name="newvps-step2"]');
  await selectRadioByRowText(form, 'location', locationLabel);
  await submitLast(form);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);

  form = page.locator('form[name="newvps-step2"]');
  await page.locator('details').first().evaluate((details) => {
    details.open = true;
  }).catch(() => {});
  await selectFirstRadio(form, 'os_template');
  await submitLast(form);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);

  form = page.locator('form[name="newvps-step3"]');
  await submitLast(form);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);
}

async function walkCloneVps(page, vpsId, locationLabel = 'Praha') {
  await goto(page, `/?page=adminvps&action=clone-step-1&veid=${vpsId}`);
  const form = page.locator('form[name="clonevps-step1"]');
  await selectRadioByRowText(form, 'location', locationLabel);
  await submitLast(form);
  await page.waitForLoadState('domcontentloaded');
  await preparePage(page);
}

module.exports = {
  exact,
  goto,
  normalizeDynamicValues,
  preparePage,
  selectFirstOption,
  selectFirstRadio,
  selectRadioByRowText,
  submitLast,
  walkCloneVps,
  walkCreateVps,
};
