import { expect, type Page, test } from '@playwright/test';

const ORIGIN = 'https://rn-sandbox.a2f0.net';
const TITLE = 'React Native TurboModule Bridge Round Trips · RN Sandbox';

const content = (page: Page, selector: string) =>
  page.locator(`head ${selector}`).getAttribute('content');

// Crawlers and link previews read the HTML before any script runs.
test.describe('static metadata', () => {
  test.use({ javaScriptEnabled: false });

  test('describes the page and names its canonical URL', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-robots-tag']).toBeUndefined();
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);

    await expect(page).toHaveTitle(TITLE);
    const description = await content(page, 'meta[name="description"]');
    expect(description?.length).toBeGreaterThanOrEqual(120);
    expect(description?.length).toBeLessThanOrEqual(160);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${ORIGIN}/`,
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('head meta[name="theme-color"]')).toHaveCount(2);

    expect(await content(page, 'meta[property="og:type"]')).toBe('website');
    expect(await content(page, 'meta[property="og:site_name"]')).toBe(
      'RN Sandbox',
    );
    expect(await content(page, 'meta[property="og:title"]')).toBe(TITLE);
    expect(await content(page, 'meta[property="og:description"]')).toBe(
      description,
    );
    expect(await content(page, 'meta[property="og:url"]')).toBe(`${ORIGIN}/`);
    expect(await content(page, 'meta[property="og:image"]')).toBe(
      `${ORIGIN}/og-image.png`,
    );
    expect(await content(page, 'meta[property="og:image:width"]')).toBe('1200');
    expect(await content(page, 'meta[property="og:image:height"]')).toBe('630');
    expect(await content(page, 'meta[property="og:image:alt"]')).toBeTruthy();
    expect(await content(page, 'meta[name="twitter:card"]')).toBe(
      'summary_large_image',
    );

    const jsonLd = await page
      .locator('head script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(jsonLd ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RN Sandbox',
      url: `${ORIGIN}/`,
      description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
    });
  });

  test('serves the 404 page that Cloudflare returns for missing paths', async ({
    page,
  }) => {
    await page.goto('/404.html');
    await expect(page).toHaveTitle('Page not found · RN Sandbox');
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page.locator('a')).toHaveAttribute('href', '/');
  });
});

test('renders one top-level heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(['Bridge round trip']);
});

// The single-page fallback answers a missing file with index.html, so each
// response is checked by its content.
test('serves robots.txt, the sitemap, and the social preview image', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect((await robots.text()).split('\n')).toEqual([
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${ORIGIN}/sitemap.xml`,
    '',
  ]);

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(sitemap.headers()['content-type']).toContain('xml');
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]*)<\/loc>/g)];
  expect(urls.map(([, url]) => url)).toEqual([`${ORIGIN}/`]);

  // Rendered from assets/brand/ by the favicons target in agent-tool.json.
  const image = await request.get('/og-image.png');
  expect(image.ok()).toBe(true);
  const png = await image.body();
  // The PNG signature, then the IHDR chunk's width and height.
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
