import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureApple } from './apple.mjs';

const identityPlatform =
  'https://identitytoolkit.googleapis.com/admin/v2/projects/p/defaultSupportedIdpConfigs';
const options = {
  identityPlatform,
  appId: 'net.a2f0.sandbox.rn',
  teamId: 'TEAM',
  servicesId: 'net.a2f0.sandbox.rn.signin',
};
const key = { id: 'KEY', privateKey: 'PRIVATE KEY' };

// Records requests, returning existing for the GET.
function fakeApi(existing, fail) {
  const calls = [];
  const api = async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === 'GET') return existing;
    if (fail) throw new Error(`${method} failed`);
    return {};
  };
  return { api, calls };
}

test('creates the provider with the key', async () => {
  const { api, calls } = fakeApi(null);
  assert.equal(await configureApple({ ...options, api, key }), true);
  assert.deepEqual(calls[1], {
    method: 'POST',
    url: `${identityPlatform}?idpId=apple.com`,
    body: {
      enabled: true,
      clientId: 'net.a2f0.sandbox.rn.signin',
      appleSignInConfig: {
        bundleIds: ['net.a2f0.sandbox.rn'],
        codeFlowConfig: {
          teamId: 'TEAM',
          keyId: 'KEY',
          privateKey: 'PRIVATE KEY',
        },
      },
    },
  });
});

test('creates the provider for iOS only without a key', async () => {
  const { api, calls } = fakeApi(null);
  assert.equal(await configureApple({ ...options, api, key: null }), false);
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].body.appleSignInConfig.codeFlowConfig, undefined);
});

test('replaces the whole Apple config when there is a key', async () => {
  const { api, calls } = fakeApi({ appleSignInConfig: {} });
  assert.equal(await configureApple({ ...options, api, key }), true);
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(
    calls[1].url,
    `${identityPlatform}/apple.com?updateMask=enabled,clientId,appleSignInConfig`,
  );
});

test("keeps the project's key on a rerun without one", async () => {
  const { api, calls } = fakeApi({
    appleSignInConfig: { codeFlowConfig: { teamId: 'TEAM', keyId: 'OLD' } },
  });
  assert.equal(await configureApple({ ...options, api, key: null }), true);
  assert.equal(
    calls[1].url,
    `${identityPlatform}/apple.com?updateMask=enabled,clientId,appleSignInConfig.bundleIds`,
  );
  assert.equal(calls[1].body.appleSignInConfig.codeFlowConfig, undefined);
});

test('fails when the update fails', async () => {
  const { api } = fakeApi({ appleSignInConfig: {} }, true);
  await assert.rejects(configureApple({ ...options, api, key }), {
    message: 'PATCH failed',
  });
});
