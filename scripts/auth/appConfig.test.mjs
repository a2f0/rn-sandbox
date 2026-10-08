import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appConfig, parseEnv, plistString } from './appConfig.mjs';

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CLIENT_ID</key>
	<string>123-abc.apps.googleusercontent.com</string>
	<key>REVERSED_CLIENT_ID</key>
	<string>com.googleusercontent.apps.123-abc</string>
	<key>BUNDLE_ID</key>
	<string>net.a2f0.sandbox.rn</string>
</dict>
</plist>`;

const firebase = {
  apiKey: 'key',
  authDomain: 'p.firebaseapp.com',
  projectId: 'p',
  appId: '1:2:web:3',
};

test('parseEnv reads plain, exported, and quoted values', () => {
  assert.deepEqual(
    parseEnv('# comment\nA=1\nexport B="two words"\nC=\'3\'\n\nnot a line\n'),
    { A: '1', B: 'two words', C: '3' },
  );
});

test('plistString reads a key and returns null when it is missing', () => {
  assert.equal(
    plistString(plist, 'CLIENT_ID'),
    '123-abc.apps.googleusercontent.com',
  );
  assert.equal(
    plistString(plist, 'REVERSED_CLIENT_ID'),
    'com.googleusercontent.apps.123-abc',
  );
  assert.equal(plistString(plist, 'API_KEY'), null);
});

test('appConfig fills each section once its inputs exist', () => {
  assert.deepEqual(
    appConfig({
      firebase,
      googleWebClientId: 'web.apps.googleusercontent.com',
      iosPlist: plist,
      apple: {
        servicesId: 'net.a2f0.sandbox.rn.signin',
        redirectUri: 'https://p.firebaseapp.com/__/auth/handler',
      },
    }),
    {
      firebase,
      google: {
        webClientId: 'web.apps.googleusercontent.com',
        iosClientId: '123-abc.apps.googleusercontent.com',
      },
      apple: {
        servicesId: 'net.a2f0.sandbox.rn.signin',
        redirectUri: 'https://p.firebaseapp.com/__/auth/handler',
      },
    },
  );
});

test('appConfig leaves Google off on iOS without both iOS client IDs', () => {
  for (const key of ['CLIENT_ID', 'REVERSED_CLIENT_ID']) {
    const config = appConfig({
      firebase,
      googleWebClientId: 'web.apps.googleusercontent.com',
      iosPlist: plist.replace(
        new RegExp(`<key>${key}</key>\\s*<string>[^<]*</string>`),
        '',
      ),
      apple: null,
    });
    assert.deepEqual(
      config.google,
      { webClientId: 'web.apps.googleusercontent.com', iosClientId: null },
      key,
    );
    assert.equal(config.apple, null);
  }
});

test('appConfig leaves Google off without its web client', () => {
  const config = appConfig({
    firebase,
    googleWebClientId: undefined,
    iosPlist: plist,
    apple: null,
  });
  assert.equal(config.google, null);
});
