// Provisions Firebase Authentication for Sign in with Google and Apple, then
// writes the app's config: bun run auth:provision. See the README.
//
// 1. Terraform (infra/auth) creates the project, Firebase, Identity Platform,
//    and the iOS, Android, and web apps.
// 2. The Firebase CLI turns on Google sign-in, which creates the OAuth consent
//    screen and client IDs that have no public API.
// 3. The Identity Platform API turns on Apple sign-in with the Sign in with
//    Apple key, which Terraform's resource can't take.
// 4. src/auth/config.json and the iOS URL scheme are written from the result.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  appConfig,
  parseEnv,
  plistString,
  TF_STATE_KEYS,
  terraformEnv,
} from './appConfig.mjs';
import { configureApple } from './apple.mjs';
import { googleApi } from './googleApi.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
// .secrets links to this project's folder in matrix-secrets (see the README),
// and this reads its prod tier. RN_SANDBOX_SECRETS_DIR names another tier
// folder in place of .secrets/prod.
const secretsDir =
  process.env.RN_SANDBOX_SECRETS_DIR ?? join(repoRoot, '.secrets/prod');
const infraDir = join(repoRoot, 'infra/auth');
const configPath = join(repoRoot, 'src/auth/config.json');
const infoPlistPath = join(repoRoot, 'ios/sandbox/Info.plist');

const APP_ID = 'net.a2f0.sandbox.rn';
const APPLE_TEAM_ID = 'H4QLD7XWGS';
// Registered by hand in the Apple Developer portal (README).
const APPLE_SERVICES_ID = 'net.a2f0.sandbox.rn.signin';
const FIREBASE_TOOLS = 'firebase-tools@15.32.1';

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function step(message) {
  console.log(`\n==> ${message}`);
}

function output(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function succeeds(command, args, options = {}) {
  return (
    spawnSync(command, args, { stdio: 'inherit', ...options }).status === 0
  );
}

// How long a command and the processes it started have to stop after a signal
// before they are killed.
const STOP_GRACE_MS = 3000;

// Runs command like succeeds, but without blocking, so this script outlives a
// signal such as Ctrl-C and can clean up after it. The command runs in its own
// process group, which gets the signal, so it reaches every process the
// command started; the group is killed if it hasn't stopped STOP_GRACE_MS
// after the first signal. Resolves once the command ends, and after a signal
// once its group has stopped, with { outcome: 'succeeded' | 'failed' } or
// { outcome: 'interrupted', signal }.
function runInterruptible(command, args, options = {}) {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  return new Promise((resolve) => {
    let interrupted;
    let stopped;
    const child = spawn(command, args, {
      stdio: 'inherit',
      detached: true,
      ...options,
    });
    const forward = (signal) => {
      interrupted ??= signal;
      // A command that failed to start has no process group.
      if (child.pid === undefined) return;
      signalGroup(child.pid, signal);
      stopped ??= stopGroup(child.pid);
    };
    for (const signal of signals) process.on(signal, forward);
    // 'close' follows 'error' as well, as when the command can't start.
    child.on('error', () => {});
    child.on('close', async (code) => {
      await stopped;
      for (const signal of signals) process.off(signal, forward);
      if (interrupted) resolve({ outcome: 'interrupted', signal: interrupted });
      else resolve({ outcome: code === 0 ? 'succeeded' : 'failed' });
    });
  });
}

// Sends signal to process group pgid. Returns false if the group has exited.
function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

// Waits for process group pgid to exit, killing it after STOP_GRACE_MS. Once
// killed, its processes no longer run, so it waits only a second more for them
// to be reaped: one whose parent is gone can stay a zombie in a container
// whose PID 1 doesn't reap.
async function stopGroup(pgid) {
  const killAt = Date.now() + STOP_GRACE_MS;
  let giveUpAt;
  while (signalGroup(pgid, 0)) {
    const now = Date.now();
    if (giveUpAt === undefined) {
      if (now >= killAt) {
        signalGroup(pgid, 'SIGKILL');
        giveUpAt = now + 1000;
      }
    } else if (now >= giveUpAt) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Stops this script with signal, as it would have without a handler.
function reraise(signal) {
  process.kill(process.pid, signal);
  fail(`Stopped by ${signal}.`);
}

function run(command, args, options = {}) {
  if (!succeeds(command, args, options)) {
    fail(`${command} ${args.join(' ')} failed.`);
  }
}

function readSecrets(file) {
  const path = join(secretsDir, file);
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

function gcloudToken() {
  try {
    return output('gcloud', ['auth', 'print-access-token']);
  } catch {
    fail('gcloud is not logged in. Run: gcloud auth login');
  }
}

// --- Credentials

step('Checking credentials');
gcloudToken();
try {
  output('gcloud', ['auth', 'application-default', 'print-access-token']);
} catch {
  fail(
    'Terraform uses Application Default Credentials. Run: gcloud auth application-default login',
  );
}
const account = output('gcloud', ['config', 'get', 'account']);
console.log(`Google account: ${account}`);

// shared.env holds values copied from the shared root, and app.env this
// project's own, which win.
const secrets = { ...readSecrets('shared.env'), ...readSecrets('app.env') };
// The Terraform state is in this project's Cloudflare R2 bucket
// (infra/auth/versions.tf). Only Terraform gets its key.
let stateEnv;
try {
  stateEnv = terraformEnv(process.env, secrets);
} catch (error) {
  fail(
    `${error.message} The Terraform state backend needs ${TF_STATE_KEYS.join(' and ')} in ${join(secretsDir, 'app.env')}.`,
  );
}

let billingAccount =
  process.env.TF_VAR_billing_account ?? secrets.RN_SANDBOX_GCP_BILLING_ACCOUNT;
if (!billingAccount) {
  const accounts = output('gcloud', [
    'billing',
    'accounts',
    'list',
    '--filter=open=true',
    '--format=value(name)',
  ])
    .split('\n')
    .filter(Boolean)
    .map((name) => name.replace(/^billingAccounts\//, ''));
  if (accounts.length !== 1) {
    fail(
      `Found ${accounts.length} open billing accounts. Set RN_SANDBOX_GCP_BILLING_ACCOUNT in .secrets/prod/app.env.`,
    );
  }
  billingAccount = accounts[0];
}
console.log(`Billing account: ${billingAccount}`);

// --- Terraform

step('Applying infra/auth');
// Through mise, for the version in .mise.toml.
const terraform = ['exec', '--', 'terraform', `-chdir=${infraDir}`];
const terraformOptions = {
  cwd: repoRoot,
  env: { ...stateEnv, TF_VAR_billing_account: billingAccount },
};
run('mise', [...terraform, 'init', '-input=false'], terraformOptions);
run('mise', [...terraform, 'apply'], terraformOptions);
const outputs = JSON.parse(
  output('mise', [...terraform, 'output', '-json'], terraformOptions),
);
const project = outputs.project_id.value;
const firebase = outputs.firebase_config.value;
const identityPlatform = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs`;
const authHandler = `https://${firebase.authDomain}/__/auth/handler`;
const api = googleApi({ project, token: gcloudToken });

// --- Google

step('Turning on Google sign-in');
const deploy = [
  '--yes',
  FIREBASE_TOOLS,
  'deploy',
  '--only',
  'auth',
  '--project',
  project,
  '--non-interactive',
];
const firebaseDir = mkdtempSync(join(tmpdir(), 'rn-sandbox-auth-'));
let deployment;
try {
  writeFileSync(
    join(firebaseDir, 'firebase.json'),
    JSON.stringify({
      auth: {
        providers: {
          googleSignIn: {
            oAuthBrandDisplayName: 'RN Sandbox',
            supportEmail: account,
            authorizedRedirectUris: [authHandler],
          },
        },
      },
    }),
  );
  deployment = await runInterruptible('npx', deploy, {
    cwd: firebaseDir,
    // The CLI uses Application Default Credentials, and only names a quota
    // project for them from here.
    env: { ...process.env, GOOGLE_CLOUD_QUOTA_PROJECT: project },
  });
} finally {
  rmSync(firebaseDir, { recursive: true, force: true });
}
// fail() and signals exit at once, skipping finally blocks, so both wait until
// the folder is gone.
if (deployment.outcome === 'interrupted') reraise(deployment.signal);
if (deployment.outcome === 'failed') fail(`npx ${deploy.join(' ')} failed.`);
const google = await api('GET', `${identityPlatform}/google.com`);
if (!google?.clientId) fail('Google sign-in has no OAuth client.');

// --- Apple

step('Turning on Apple sign-in');
const keyId = secrets.RN_SANDBOX_APPLE_SIGN_IN_KEY_ID;
const keyPath = keyId ? join(secretsDir, `AuthKey_${keyId}.p8`) : null;
const hasKey = keyPath !== null && existsSync(keyPath);
const appleOnWeb = await configureApple({
  api,
  identityPlatform,
  appId: APP_ID,
  teamId: APPLE_TEAM_ID,
  servicesId: APPLE_SERVICES_ID,
  key: hasKey ? { id: keyId, privateKey: readFileSync(keyPath, 'utf8') } : null,
});
if (!appleOnWeb) {
  console.warn(
    'No Sign in with Apple key yet, so Apple sign-in works on iOS only. See the README.',
  );
}

// --- App config

step('Writing the app config');
const iosApp = await api(
  'GET',
  `https://firebase.googleapis.com/v1beta1/projects/${project}/iosApps/${outputs.apple_app_id.value}/config`,
);
if (!iosApp?.configFileContents) fail('The iOS app has no Firebase config.');
const iosPlist = Buffer.from(iosApp.configFileContents, 'base64').toString(
  'utf8',
);
const config = appConfig({
  firebase,
  googleWebClientId: google.clientId,
  iosPlist,
  apple: appleOnWeb
    ? { servicesId: APPLE_SERVICES_ID, redirectUri: authHandler }
    : null,
});
// Google Sign-In on iOS returns to the app through its reversed client ID,
// and crashes release builds without it (appConfig.mjs), so the URL scheme is
// added first: if that fails, the config doesn't turn Google on for iOS.
const reversedClientId = plistString(iosPlist, 'REVERSED_CLIENT_ID');
if (config.google.iosClientId && reversedClientId) {
  run('plutil', [
    '-replace',
    'CFBundleURLTypes',
    '-json',
    JSON.stringify([{ CFBundleURLSchemes: [reversedClientId] }]),
    infoPlistPath,
  ]);
  console.log(`Added the ${reversedClientId} URL scheme to ${infoPlistPath}`);
}

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${configPath}`);
if (!config.google.iosClientId) {
  console.warn(
    "The iOS app's Firebase config has no OAuth client yet, so Google sign-in is off on iOS. Run this again in a few minutes.",
  );
}

step('Done');
console.log(
  'Commit src/auth/config.json and ios/sandbox/Info.plist, then rebuild the apps.',
);
