import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleApi } from './googleApi.mjs';

function client(status, text, requests = []) {
  return googleApi({
    project: 'p',
    token: () => 'token',
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { status, ok: status < 400, text: async () => text };
    },
  });
}

test('sends JSON with the token and quota project', async () => {
  const requests = [];
  const api = client(200, '{"name":"x"}', requests);
  assert.deepEqual(await api('PATCH', 'https://api/x', { enabled: true }), {
    name: 'x',
  });
  assert.equal(requests[0].init.method, 'PATCH');
  assert.equal(requests[0].init.body, '{"enabled":true}');
  assert.deepEqual(requests[0].init.headers, {
    authorization: 'Bearer token',
    'content-type': 'application/json',
    'x-goog-user-project': 'p',
  });
});

test('reads a missing resource as null', async () => {
  assert.equal(await client(404, '')('GET', 'https://api/x'), null);
});

test('fails a write that returns 404, or any error', async () => {
  await assert.rejects(client(404, 'gone')('POST', 'https://api/x', {}), {
    message: 'POST https://api/x returned 404: gone',
  });
  await assert.rejects(client(403, 'denied')('GET', 'https://api/x'), {
    message: 'GET https://api/x returned 403: denied',
  });
});
