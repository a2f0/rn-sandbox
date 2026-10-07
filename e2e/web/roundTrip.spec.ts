import { expect, test } from '@playwright/test';

test('round-trips every case through the web modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('roundtrip-summary')).toBeVisible();
  await expect(page.getByTestId('roundtrip-status')).toHaveText('passed');
});
