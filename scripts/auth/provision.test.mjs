import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = join(import.meta.dirname, 'provision.mjs');

// Stand-ins for gcloud, mise (Terraform) and npx (the Firebase CLI). PATH
// holds only these, so the script can't reach a real cloud tool.
const fakes = {
  gcloud: 'printf "%s\\n" fake',
  mise: `case "$*" in
  *" output -json") printf '%s\\n' '{"project_id":{"value":"p"},"firebase_config":{"value":{"authDomain":"p.firebaseapp.com"}},"apple_app_id":{"value":"ios"}}' ;;
esac`,
  npx: 'exit 1',
};

// A folder holding the fakes, with overrides, and the environment that runs
// the script on them.
function setUp(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'provision-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const temp = join(root, 'tmp');
  const secrets = join(root, 'secrets');
  for (const dir of [bin, temp, secrets]) mkdirSync(dir);
  for (const [name, body] of Object.entries({ ...fakes, ...overrides })) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
  const env = {
    PATH: bin,
    HOME: root,
    TMPDIR: temp,
    RN_SANDBOX_SECRETS_DIR: secrets,
    TF_STATE_ACCESS_KEY_ID: 'id',
    TF_STATE_SECRET_ACCESS_KEY: 'key',
    TF_VAR_billing_account: 'billing',
  };
  return { root, temp, env };
}

test('removes the Firebase CLI folder when its deploy fails', (t) => {
  const { temp, env } = setUp(t);

  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env,
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /npx --yes firebase-tools@.* deploy .* failed\./);
  assert.deepEqual(readdirSync(temp), []);
});

// Runs the script with a fake deploy that starts a process of its own, as npx
// does, running deploy, and interrupts the script once that process has
// started. PATH holds only the fakes, so the fake names node in full. npx
// runs first in the fake, as a shell command.
async function interruptDeploy(t, deploy, npx = '') {
  const { root, temp, env } = setUp(t, {
    npx: `${npx}\n"$NODE" -e "$DEPLOY" &\nwait\necho finished`,
  });
  const started = join(root, 'deploy-started');
  const child = spawn(process.execPath, [script], {
    env: {
      ...env,
      NODE: process.execPath,
      DEPLOY: `${deploy}
        require('node:fs').writeFileSync(process.env.DEPLOY_STARTED, String(process.pid));
        setTimeout(() => {}, 30_000);`,
      DEPLOY_STARTED: started,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const exited = new Promise((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal })),
  );
  const deadline = Date.now() + 10_000;
  while (!existsSync(started) || readFileSync(started, 'utf8') === '') {
    assert.ok(
      child.exitCode === null && child.signalCode === null,
      `The script exited before the deploy started.\n${output}`,
    );
    assert.ok(Date.now() < deadline, `The deploy never started.\n${output}`);
    await sleep(20);
  }
  const deployPid = Number(readFileSync(started, 'utf8'));
  t.after(() => stop(deployPid));

  child.kill('SIGINT');
  let timer;
  const result = await Promise.race([
    exited,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), 10_000);
    }),
  ]);
  clearTimeout(timer);
  if (result.timedOut) child.kill('SIGKILL');
  return { result, output: () => output, deployPid, temp };
}

test('waits for the deploy to stop, then removes its folder', async (t) => {
  // The deploy takes a moment to stop.
  const { result, output, deployPid, temp } = await interruptDeploy(
    t,
    "process.on('SIGINT', () => setTimeout(() => process.exit(130), 300));",
  );

  assert.equal(result.signal, 'SIGINT', output());
  assert.doesNotMatch(output(), /finished/);
  assert.equal(isRunning(deployPid), false);
  assert.deepEqual(readdirSync(temp), []);
});

test('kills a deploy that ignores the signal, then removes its folder', async (t) => {
  const { result, output, deployPid, temp } = await interruptDeploy(
    t,
    "process.on('SIGINT', () => {});",
  );

  assert.equal(result.signal, 'SIGINT', output());
  assert.equal(isRunning(deployPid), false);
  assert.deepEqual(readdirSync(temp), []);
});

test('kills a deploy whose npx ignores the signal, then removes its folder', async (t) => {
  const { result, output, deployPid, temp } = await interruptDeploy(
    t,
    "process.on('SIGINT', () => {});",
    "trap '' INT",
  );

  assert.equal(result.signal, 'SIGINT', output());
  assert.equal(isRunning(deployPid), false);
  assert.deepEqual(readdirSync(temp), []);
});

// Google's and Firebase's APIs, as provision.mjs reaches them through fetch:
// Google sign-in is on, Apple sign-in isn't set up yet, and the iOS app's
// Firebase config has its client IDs.
const fakeApis = `
const plist = '<key>CLIENT_ID</key><string>ios-client</string>' +
  '<key>REVERSED_CLIENT_ID</key><string>com.example.ios-client</string>';
globalThis.fetch = async (url, { method }) => {
  const reply = (status, body) =>
    new Response(body === undefined ? '' : JSON.stringify(body), { status });
  if (url.endsWith('/google.com')) return reply(200, { clientId: 'web-client' });
  if (url.endsWith('/apple.com')) return reply(404);
  if (method === 'POST') return reply(200, {});
  if (url.includes('/iosApps/')) {
    return reply(200, { configFileContents: Buffer.from(plist).toString('base64') });
  }
  return reply(500, { unexpected: url });
};
`;

test('leaves the app config alone when the iOS URL scheme fails', (t) => {
  // The script writes its outputs under its own repository, so it runs from a
  // copy in a stand-in one.
  const { root, env } = setUp(t, { npx: 'exit 0', plutil: 'exit 1' });
  const repo = join(root, 'repo');
  for (const dir of ['scripts/auth', 'src/auth', 'ios/sandbox']) {
    mkdirSync(join(repo, dir), { recursive: true });
  }
  for (const file of [
    'provision.mjs',
    'appConfig.mjs',
    'apple.mjs',
    'googleApi.mjs',
  ]) {
    copyFileSync(
      join(import.meta.dirname, file),
      join(repo, 'scripts/auth', file),
    );
  }
  const configPath = join(repo, 'src/auth/config.json');
  const unprovisioned = '{ "firebase": null, "google": null, "apple": null }\n';
  writeFileSync(configPath, unprovisioned);
  writeFileSync(join(repo, 'ios/sandbox/Info.plist'), '');
  const apis = join(root, 'apis.mjs');
  writeFileSync(apis, fakeApis);

  const result = spawnSync(
    process.execPath,
    ['--import', apis, join(repo, 'scripts/auth/provision.mjs')],
    { encoding: 'utf8', env },
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /plutil -replace CFBundleURLTypes .* failed\./);
  assert.equal(readFileSync(configPath, 'utf8'), unprovisioned);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

function stop(pid) {
  if (isRunning(pid)) process.kill(pid, 'SIGKILL');
}
