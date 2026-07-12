const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'cluster/default-config.json')));
const shape = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/production-shape.json')));

const locations = new Map(shape.environments.flatMap((environment) =>
  environment.locations.map((location) => [location.key, location.domain])));
assert.deepStrictEqual(Object.fromEntries(locations), {
  praha: 'prg',
  brno: 'brq',
  playground: 'pgnd',
  'praha-storage': 'prg',
  staging: 'stg',
});

const expected = {
  node1: 'node1.prg',
  node2: 'node1.pgnd',
  backuper1: 'backuper1.prg',
};
const actual = Object.fromEntries(Object.entries(config.nodes).map(([machineName, node]) => [
  machineName,
  `${node.name}.${locations.get(node.location)}`,
]));
assert.deepStrictEqual(actual, expected);
assert.strictEqual(new Set(Object.values(actual)).size, Object.keys(expected).length);
assert.deepStrictEqual(config.topologies.screenshots, Object.keys(expected));
for (const node of Object.values(config.nodes)) {
  const hosts = new Map([[node.name, node.ip]]);
  for (const [machineName, peer] of Object.entries(config.nodes)) {
    hosts.set(actual[machineName], peer.ip);
  }
  assert.strictEqual(hosts.get(node.name), node.ip);
}

const nixSource = fs.readFileSync(path.join(root, 'cluster/nix/test.nix'), 'utf8');
const hostHelper = nixSource.slice(
  nixSource.indexOf('nodeHostNames ='),
  nixSource.indexOf('nodeRecords ='),
);
assert(!hostHelper.includes('machineName'));
assert.match(nixSource, /devHosts\.\$\{node\.ip\} or \[ \]\) \+\+ \[ node\.name \]/);
assert(!nixSource.includes('nameValuePair peer.name peer.ip'));
assert(!nixSource.includes('nameValuePair peer.machineName peer.ip'));
assert.match(nixSource, /nameValuePair peer\.domainName peer\.ip/g);
