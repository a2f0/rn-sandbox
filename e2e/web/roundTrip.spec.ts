import { expect, test } from '@playwright/test';

test('round-trips every case through the web modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('roundtrip-summary')).toBeVisible();
  await expect(page.getByTestId('roundtrip-status')).toHaveText('passed');
});

test('saves files to IndexedDB before writes settle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('roundtrip-summary')).toBeVisible();
  // Read at once: every write awaited its save before its case finished.
  const paths = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('/roundtrip');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db
            .transaction(db.objectStoreNames[0])
            .objectStore(db.objectStoreNames[0]);
          const keys = store.getAllKeys();
          keys.onsuccess = () => resolve(keys.result.map(String));
        };
      }),
  );
  expect(paths).toEqual(
    expect.arrayContaining([
      '/roundtrip/full.json',
      '/roundtrip/sparse.json',
      '/roundtrip/bytes.bin',
      '/roundtrip/malformed.json',
    ]),
  );
  expect(paths).not.toContain('/roundtrip/deleted.json');
});

test('expands and collapses a case when clicked', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('roundtrip-summary')).toBeVisible();
  const row = page.getByTestId('roundtrip-case-sync-string');
  const description = page.getByTestId(
    'roundtrip-case-sync-string-description',
  );
  await expect(description).toHaveCount(0);
  await row.click();
  await expect(description).toBeVisible();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await row.click();
  await expect(description).toHaveCount(0);
});
