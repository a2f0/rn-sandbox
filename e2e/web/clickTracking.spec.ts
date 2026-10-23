import type { ClickEvent } from '@a2f0/ct-client';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { createServer } from 'vite';

const ORIGIN = 'https://rn-sandbox.a2f0.net';
const COLLECTOR = 'https://ct.a2f0.net/v1/clicks';

interface Batch {
  site: string;
  environment: string;
  events: ClickEvent[];
}

type Preference = 'gpc' | 'dnt' | 'webdriver' | 'extension' | 'saved';

async function open(
  browser: Browser,
  fixtureOrigin: string | undefined,
  preference: Preference = 'gpc',
  origin = ORIGIN,
  developmentFixture = false,
) {
  if (!fixtureOrigin) throw new Error('Missing local fixture server');
  const context = await browser.newContext();
  const batches: Batch[] = [];
  const errors: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.href === COLLECTOR) {
      expect(route.request().headers().referer ?? '').not.toMatch(
        /private|token|#/,
      );
      batches.push(route.request().postDataJSON() as Batch);
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': origin },
      });
    } else if (url.origin === origin) {
      if (developmentFixture && url.pathname === '/') {
        await route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><button data-testid="roundtrip-run">Click</button>
<div data-testid="roundtrip-status">loading</div><script type="module">
import { createWebTracker } from '/web/tracking.ts';
createWebTracker()?.init();
document.querySelector('[data-testid="roundtrip-status"]').textContent = 'passed';
</script>`,
        });
        return;
      }
      const response = await route.fetch({
        url: new URL(url.pathname + url.search, fixtureOrigin).href,
      });
      await route.fulfill({ response });
    } else {
      // No simulated click or sign-in request can reach an external service.
      await route.abort();
    }
  });
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.addInitScript((setting: Preference) => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => setting === 'webdriver',
    });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      get: () => true,
    });
    Object.defineProperty(navigator, 'doNotTrack', {
      get: () => (setting === 'dnt' ? '1' : '0'),
    });
    if (setting === 'saved') localStorage.setItem('ct:opt-out', '1');
    if (setting === 'extension') {
      const disable = () =>
        document.documentElement?.setAttribute('data-ct-disabled', '');
      new MutationObserver(disable).observe(document, {
        childList: true,
        subtree: true,
      });
      disable();
    }
  }, preference);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/?token=private-value#private-fragment`);
  await expect(page.getByTestId('roundtrip-status')).toHaveText('passed');
  return { context, page, batches, errors };
}

async function flush(page: Page, expected: boolean) {
  const sent = expected ? page.waitForResponse(COLLECTOR) : undefined;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide')),
  );
  if (sent) await sent;
  else await page.waitForTimeout(200);
}

test('captures real controls and text clicks with fixed, private metadata', async ({
  browser,
  baseURL,
}) => {
  const { context, page, batches, errors } = await open(browser, baseURL);
  try {
    await page.evaluate(() =>
      history.replaceState(null, '', '/private-user-id?token=secret#hidden'),
    );
    await page.getByTestId('roundtrip-run').click();
    await expect(page.getByTestId('roundtrip-status')).toHaveText('passed');
    const row = page.getByTestId('roundtrip-case-sync-string');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('signin-status').evaluate((element) => {
      element.textContent = 'Signed in as private@example.com';
    });
    await page.getByTestId('signin-status').click();
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'private-field';
      input.value = 'private form value';
      input.style.cssText = 'position:fixed;top:0;left:0;z-index:9999';
      document.body.append(input);
    });
    await page.locator('#private-field').click();
    await page.evaluate(() => {
      document.querySelector('#private-field')?.remove();
      for (const [id, attribute] of [
        ['private-editable', 'contenteditable'],
        ['private-ignored', 'data-ct-ignore'],
      ]) {
        const element = document.createElement('div');
        element.id = id;
        element.setAttribute(attribute, 'true');
        element.textContent = 'private editable or ignored content';
        document.body.append(element);
      }
    });
    await page.locator('#private-editable').click();
    await page.locator('#private-ignored').click();
    await flush(page, true);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      site: 'rn-sandbox',
      environment: 'production',
    });
    expect(batches[0]?.events).toHaveLength(3);
    expect(batches[0]?.events.map(({ target }) => target)).toEqual([
      'button',
      'button',
      'div',
    ]);
    for (const event of batches[0]?.events ?? []) {
      expect(event).toMatchObject({
        app: 'web-app',
        page: '/',
        label: null,
      });
      expect(Object.keys(event).sort()).toEqual([
        'app',
        'id',
        'label',
        'page',
        'target',
        'timestamp',
      ]);
    }
    expect(JSON.stringify(batches)).not.toMatch(
      /private|secret|hidden|Signed|roundtrip|https:|@example/,
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const preference of ['dnt', 'webdriver', 'extension', 'saved'] as const) {
  test(`${preference} prevents collection despite the GPC override`, async ({
    browser,
    baseURL,
  }) => {
    const { context, page, batches, errors } = await open(
      browser,
      baseURL,
      preference,
    );
    try {
      await page.getByTestId('roundtrip-run').click();
      await flush(page, false);
      expect(batches).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const preference of ['extension', 'saved'] as const) {
  test(`${preference} discards already queued clicks`, async ({
    browser,
    baseURL,
  }) => {
    const { context, page, batches } = await open(browser, baseURL);
    try {
      await page.getByTestId('roundtrip-run').click();
      await page.evaluate((setting) => {
        if (setting === 'extension') {
          document.documentElement.setAttribute('data-ct-disabled', '');
        } else localStorage.setItem('ct:opt-out', '1');
        document.dispatchEvent(new Event('ct:opt-out-change'));
      }, preference);
      await flush(page, false);
      expect(batches).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const origin of [
  'https://preview.example.com',
  'http://rn-sandbox.a2f0.net',
  'http://localhost:4173',
]) {
  test(`production assets refuse capture on ${origin}`, async ({
    browser,
    baseURL,
  }) => {
    const { context, page, batches } = await open(
      browser,
      baseURL,
      'gpc',
      origin,
    );
    try {
      await page.getByTestId('roundtrip-run').click();
      await flush(page, false);
      expect(batches).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('the development module stays inert on the production origin', async ({
  browser,
}) => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await server.listen();
  try {
    const fixture = server.resolvedUrls?.local[0];
    expect(fixture).toBeTruthy();
    const { context, page, batches } = await open(
      browser,
      fixture,
      'gpc',
      ORIGIN,
      true,
    );
    try {
      await page.getByTestId('roundtrip-run').click();
      await flush(page, false);
      expect(batches).toEqual([]);
    } finally {
      await context.close();
    }
  } finally {
    await server.close();
  }
});
