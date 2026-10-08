// Pure helpers for provision.mjs, tested in appConfig.test.mjs.

// Reads KEY=value lines, optionally prefixed with export and quoted, as the
// .secrets env files are written.
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
