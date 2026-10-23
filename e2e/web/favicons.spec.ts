import { expect, test } from '@playwright/test';

test('links the favicons in the page head', async ({ page }) => {
  await page.goto('/');
  const links = await page
    .locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        rel: element.getAttribute('rel'),
        href: element.getAttribute('href'),
        sizes: element.getAttribute('sizes'),
        type: element.getAttribute('type'),
      })),
    );
  expect(links).toEqual([
    { rel: 'icon', href: '/favicon.ico', sizes: 'any', type: null },
    { rel: 'icon', href: '/favicon.svg', sizes: null, type: 'image/svg+xml' },
    {
      rel: 'apple-touch-icon',
      href: '/apple-touch-icon.png',
      sizes: null,
      type: null,
    },
  ]);
});

// The build renders these from assets/brand/ (the favicons target in
// agent-tool.json). The single-page fallback answers a missing file with
// index.html, so each response is checked by its content.
test('serves the favicons rendered from the brand SVGs', async ({
  request,
}) => {
  const svg = await request.get('/favicon.svg');
  expect(svg.ok()).toBe(true);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  expect(await svg.text()).toMatch(
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
  );

  const ico = await request.get('/favicon.ico');
  expect(ico.ok()).toBe(true);
  const icon = await ico.body();
  // An icon directory of three images, each entry starting with its width
  // and height.
  expect([...icon.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
  expect(
    [0, 1, 2].map((index) => [icon[6 + index * 16], icon[7 + index * 16]]),
  ).toEqual([
    [16, 16],
    [32, 32],
    [48, 48],
  ]);

  const png = await request.get('/apple-touch-icon.png');
  expect(png.ok()).toBe(true);
  const touch = await png.body();
  // The PNG signature, then the IHDR chunk's width and height.
  expect(touch.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect([touch.readUInt32BE(16), touch.readUInt32BE(20)]).toEqual([180, 180]);
});
