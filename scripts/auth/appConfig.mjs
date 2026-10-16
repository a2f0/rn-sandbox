// Pure helpers for provision.mjs, tested in appConfig.test.mjs.

// Reads KEY=value lines, optionally prefixed with export and quoted, as the
// .secrets/prod env files (shared.env and app.env) are written.
export function parseEnv(text) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/,
    );
    if (!match) continue;
    const value = match[2].trim();
    values[match[1]] = value.replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

// Terraform's S3 backend keeps infra/auth's state in Cloudflare R2, with the
// key in these .secrets/prod values.
export const TF_STATE_KEYS = [
  'TF_STATE_ACCESS_KEY_ID',
  'TF_STATE_SECRET_ACCESS_KEY',
];

// The environment for Terraform alone: env with the R2 state key (from env or,
// failing that, the secrets files) as the AWS variables the backend reads, and
// without AWS_PROFILE or AWS_SESSION_TOKEN, which could redirect it. Throws
// naming whichever key is missing.
export function terraformEnv(env, secrets) {
  const values = TF_STATE_KEYS.map((name) => env[name] || secrets[name]);
  const missing = TF_STATE_KEYS.filter((_, index) => !values[index]);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(' and ')}.`);
  }
  const result = {
    ...env,
    AWS_ACCESS_KEY_ID: values[0],
    AWS_SECRET_ACCESS_KEY: values[1],
  };
  delete result.AWS_PROFILE;
  delete result.AWS_SESSION_TOKEN;
  return result;
}

// A string value from a GoogleService-Info.plist.
export function plistString(plist, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = plist.match(
    new RegExp(`<key>${escaped}</key>\\s*<string>([^<]*)</string>`),
  );
  return match ? match[1] : null;
}

// The app's src/auth/config.json. A section stays null until everything it
// needs exists, which leaves that sign-in off. Google on iOS also needs the iOS
// client's reversed ID: provision.mjs registers it as a URL scheme, without
// which Google Sign-In crashes iOS release builds.
export function appConfig({ firebase, googleWebClientId, iosPlist, apple }) {
  const iosClientId = iosPlist ? plistString(iosPlist, 'CLIENT_ID') : null;
  const reversedClientId = iosPlist
    ? plistString(iosPlist, 'REVERSED_CLIENT_ID')
    : null;
  return {
    firebase,
    google: googleWebClientId
      ? {
          webClientId: googleWebClientId,
          iosClientId: iosClientId && reversedClientId ? iosClientId : null,
        }
      : null,
    apple: apple
      ? { servicesId: apple.servicesId, redirectUri: apple.redirectUri }
      : null,
  };
}
