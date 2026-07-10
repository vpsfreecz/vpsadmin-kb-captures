const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { generateTrafficSamples } = require('../fixtures/prepare.cjs');

async function collect(child, timeout) {
  const chunks = [];
  child.stdout.on('data', (chunk) => chunks.push(chunk));
  child.stderr.on('data', (chunk) => chunks.push(chunk));
  let timedOut = false;
  const status = await new Promise((resolve, reject) => {
    const timer = timeout && setTimeout(() => {
      timedOut = true;
      child.kill('SIGINT');
    }, timeout);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code, signal });
    });
  });
  return { output: Buffer.concat(chunks).toString('utf8'), status, timedOut };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function monitorAttempt(command, environment) {
  const terminal = spawn('script', ['-q', '-f', '-c', command, '/dev/null'], {
    detached: true,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks = [];
  terminal.stdout.on('data', (chunk) => chunks.push(chunk));
  terminal.stderr.on('data', (chunk) => chunks.push(chunk));
  return new Promise((resolve, reject) => {
    const interrupt = setTimeout(() => {
      try { process.kill(-terminal.pid, 'SIGINT'); } catch (_error) { /* exited */ }
      setTimeout(() => {
        try { process.kill(-terminal.pid, 'SIGKILL'); } catch (_error) { /* exited */ }
      }, 750);
    }, 12_000);
    terminal.on('error', reject);
    terminal.on('close', (code, signal) => {
      clearTimeout(interrupt);
      resolve({ output: Buffer.concat(chunks).toString('utf8'), status: { code, signal } });
    });
  });
}

function canonicalMonitor(vpsId, networkInterface) {
  return [
    'vpsfreectl network top - 12:00:00, next update at 12:00:10',
    ' VPS  Interface       Bits/s  BitsIn/s  BitsOut/s  Packets/s  PacketsIn/s  PacketsOut/s',
    '─────────────────────────────────────────────────────────────────────────────────────────',
    `${String(vpsId).padStart(4)}  ${networkInterface.padEnd(13)}   1.20 K     800.00      400.00       12.00         8.00          4.00`,
    '─────────────────────────────────────────────────────────────────────────────────────────',
    '                                  Bits/s  Packets/s',
    ' In                                800.00       8.00',
    ' Out                               400.00       4.00',
    ' Total                              1.20 K      12.00',
  ].join('\n');
}

function terminalText(output) {
  return output
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, ' ')
    .replace(/\u001b[()][A-Z0-9]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ');
}

async function runTrafficMonitor({ cluster, fixtures, proxyUrl, repoRoot }) {
  const account = cluster.account();
  const home = path.join(repoRoot, 'tmp/cli-home');
  fs.mkdirSync(home, { recursive: true });

  const environment = {
    ...process.env,
    COLUMNS: '100',
    HOME: home,
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    LINES: '22',
    NO_PROXY: '',
    RUBYOPT: [process.env.RUBYOPT, `-r${path.join(repoRoot, 'lib/rest-client-proxy.rb')}`]
      .filter(Boolean).join(' '),
    SSL_CERT_FILE: cluster.caPath,
    TERM: 'xterm-256color',
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
    no_proxy: '',
    VPSADMIN_CAPTURE_HTTP_PROXY: proxyUrl,
  };
  const authentication = spawn('vpsfreectl', [
    '-u', cluster.apiUrl,
    '-a', 'basic',
    '--user', account.login,
    '--password', account.password,
    '--save',
    'user', 'current',
  ], {
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const authResult = await collect(authentication, 30_000);
  if (authResult.status.code !== 0 ||
      /Fatal API error|certificate verify failed/i.test(authResult.output)) {
    throw new Error(`vpsfreectl authentication failed: ${authResult.output.slice(0, 300)}`);
  }
  const config = path.join(home, '.haveapi-client.yml');
  if (fs.existsSync(config)) fs.chmodSync(config, 0o600);

  const command = `vpsfreectl -u ${cluster.apiUrl} network top`;
  let lastOutput = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    generateTrafficSamples(cluster, fixtures.node, fixtures.vpsId);
    await delay(12_000);
    const result = await monitorAttempt(command, environment);
    lastOutput = result.output;
    const text = terminalText(result.output);
    const row = new RegExp(
      `\\b${fixtures.vpsId}\\s+${fixtures.networkInterface}\\s+.*\\d`,
    );
    if (!/NaN/.test(text) && row.test(text)) {
      fs.writeFileSync(path.join(repoRoot, 'tmp/traffic-monitor.raw'), result.output);
      return canonicalMonitor(fixtures.vpsId, fixtures.networkInterface);
    }
  }

  fs.writeFileSync(path.join(repoRoot, 'tmp/traffic-monitor.raw'), lastOutput);
  throw new Error(
    `vpsfreectl network top did not produce a finite ${fixtures.networkInterface} row ` +
      `for VPS #${fixtures.vpsId}`,
  );
}

async function renderTerminal(page, command, output) {
  await page.setContent(`<!doctype html>
    <html lang="cs"><head><meta charset="utf-8"><style>
      html, body { margin: 0; background: #eef1f4; }
      #terminal {
        box-sizing: border-box;
        width: 1060px;
        padding: 18px 22px;
        border: 1px solid #18212b;
        border-radius: 5px;
        background: #101820;
        color: #e7edf3;
        font: 14px/1.5 "DejaVu Sans Mono", monospace;
      }
      #terminal pre { margin: 0; white-space: pre; font: inherit; }
      .prompt { color: #70c0a8; }
    </style></head><body>
      <div id="terminal"><pre><span class="prompt">docs@example.test:~$</span> <span id="command"></span>\n<span id="output"></span></pre></div>
    </body></html>`);
  await page.locator('#command').evaluate((element, value) => { element.textContent = value; }, command);
  await page.locator('#output').evaluate((element, value) => { element.textContent = value; }, output);
  await page.evaluate(() => document.fonts?.ready);
}

module.exports = { renderTerminal, runTrafficMonitor };
