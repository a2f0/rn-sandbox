// Provisions Firebase Authentication for Sign in with Google and Apple, then
// writes the app's config: npm run auth:provision. See the README.
//
// 1. Terraform (infra/auth) creates the project, Firebase, Identity Platform,
//    and the iOS, Android, and web apps.
// 2. The Firebase CLI turns on Google sign-in, which creates the OAuth consent
//    screen and client IDs that have no public API.
// 3. The Identity Platform API turns on Apple sign-in with the Sign in with
//    Apple key, which Terraform's resource can't take.
// 4. src/auth/config.json and the iOS URL scheme are written from the result.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appConfig, parseEnv, plistString } from './appConfig.mjs';
import { configureApple } from './apple.mjs';
import { googleApi } from './googleApi.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const secretsDir =
  process.env.RN_SANDBOX_SECRETS_DIR ?? join(repoRoot, '.secrets');
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
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

const root = readSecrets('root.env');
const sandbox = readSecrets('rn-sandbox.env');
// The Terraform state is in S3, with the a2f0.net stack's.
for (const name of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
  const value = process.env[name] || root[name];
  if (!value) fail(`${name} is missing from .secrets/root.env.`);
  process.env[name] = value;
}

let billingAccount =
  process.env.TF_VAR_billing_account ?? sandbox.RN_SANDBOX_GCP_BILLING_ACCOUNT;
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
      `Found ${accounts.length} open billing accounts. Set RN_SANDBOX_GCP_BILLING_ACCOUNT in .secrets/rn-sandbox.env.`,
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
  env: { ...process.env, TF_VAR_billing_account: billingAccount },
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
const firebaseDir = mkdtempSync(join(tmpdir(), 'rn-sandbox-auth-'));
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
  run(
    'npx',
    [
      '--yes',
      FIREBASE_TOOLS,
      'deploy',
      '--only',
      'auth',
      '--project',
      project,
      '--non-interactive',
    ],
    {
      cwd: firebaseDir,
      // The CLI uses Application Default Credentials, and only names a quota
      // project for them from here.
      env: { ...process.env, GOOGLE_CLOUD_QUOTA_PROJECT: project },
    },
  );
} finally {
  rmSync(firebaseDir, { recursive: true, force: true });
}
const google = await api('GET', `${identityPlatform}/google.com`);
if (!google?.clientId) fail('Google sign-in has no OAuth client.');

// --- Apple

step('Turning on Apple sign-in');
const keyId = sandbox.RN_SANDBOX_APPLE_SIGN_IN_KEY_ID;
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
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${configPath}`);
if (!config.google.iosClientId) {
  console.warn(
    "The iOS app's Firebase config has no OAuth client yet, so Google sign-in is off on iOS. Run this again in a few minutes.",
  );
}

// Google Sign-In on iOS returns to the app through its reversed client ID.
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

step('Done');
console.log(
  'Commit src/auth/config.json and ios/sandbox/Info.plist, then rebuild the apps.',
);
