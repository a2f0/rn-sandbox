import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
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
  *" output -json") printf '%s\\n' '{"project_id":{"value":"p"},"firebase_config":{"value":{"authDomain":"p.firebaseapp.com"}}}' ;;
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
