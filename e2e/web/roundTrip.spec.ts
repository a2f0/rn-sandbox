import { expect, test } from '@playwright/test';

test('round-trips every case through the web modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('roundtrip-summary')).toBeVisible();
  await expect(page.getByTestId('roundtrip-status')).toHaveText('passed');
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
