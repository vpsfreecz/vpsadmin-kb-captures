const assert = require('assert/strict');

const {
  datasetIdFromHref,
  datasetIdsFromHrefs,
} = require('../lib/dataset-links.cjs');

const base = 'https://webui.example.test/?page=dataset&';

assert.equal(datasetIdFromHref(`${base}action=mount&dataset=5&vps=1`), 5);
assert.equal(datasetIdFromHref(`${base}action=edit&id=5`), 5);
assert.equal(datasetIdFromHref(`${base}action=destroy&id=5`), 5);
assert.equal(datasetIdFromHref(`${base}action=mount_toggle&id=4`), null);
assert.equal(datasetIdFromHref(`${base}action=mount_edit&id=4`), null);
assert.equal(datasetIdFromHref(`${base}action=mount_destroy&id=4`), null);
assert.equal(datasetIdFromHref(`${base}action=edit&id=invalid`), null);
assert.equal(datasetIdFromHref('not a URL'), null);

assert.deepEqual(datasetIdsFromHrefs([
  `${base}action=mount&dataset=5`,
  `${base}action=edit&id=5`,
  `${base}action=mount_edit&id=4`,
]), [5]);
assert.deepEqual(datasetIdsFromHrefs([
  `${base}action=edit&id=5`,
  `${base}action=destroy&id=6`,
]), [5, 6]);
