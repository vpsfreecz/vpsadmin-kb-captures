const { goto } = require('../lib/webui.cjs');

async function run({ page, session }) {
  await goto(page, '/?page=adminm&section=members&action=resource_packages&id=2');
  await session.locator(page, 'environments/resource-package-detail', page.locator('#content-in'));

  await goto(page, '/?page=adminm&section=members&action=cluster_resources&id=2');
  await session.locator(page, 'environments/cluster-resources', page.locator('#content-in'));

  await goto(page, '/?page=adminm&section=members&action=env_cfg&id=2');
  await session.locator(page, 'environments/environment-configs', page.locator('#content-in'));
}

module.exports = { run };
