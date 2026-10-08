// A client for Google's REST APIs that bills the request's quota to project,
// as user credentials need. token() returns an access token.
export function googleApi({ project, token, fetch = globalThis.fetch }) {
  return async (method, url, body) => {
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token()}`,
        'content-type': 'application/json',
        'x-goog-user-project': project,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // A GET of something that doesn't exist returns null; any other 404 failed.
    if (response.status === 404 && method === 'GET') return null;
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${url} returned ${response.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  };
}
