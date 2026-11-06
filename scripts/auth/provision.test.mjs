import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
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

test('removes the Firebase CLI folder when its deploy fails', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'provision-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const temp = join(root, 'tmp');
  const secrets = join(root, 'secrets');
  for (const dir of [bin, temp, secrets]) mkdirSync(dir);
  for (const [name, body] of Object.entries(fakes)) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }

  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      PATH: bin,
      HOME: root,
      TMPDIR: temp,
      RN_SANDBOX_SECRETS_DIR: secrets,
      TF_STATE_ACCESS_KEY_ID: 'id',
      TF_STATE_SECRET_ACCESS_KEY: 'key',
      TF_VAR_billing_account: 'billing',
    },
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /npx --yes firebase-tools@.* deploy .* failed\./);
  assert.deepEqual(readdirSync(temp), []);
});
