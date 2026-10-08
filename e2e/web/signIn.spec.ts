import { expect, test } from '@playwright/test';

test('shows the sign-in bar', async ({ page }) => {
  await page.goto('/');
  // Signed out once a Firebase project is provisioned, otherwise not set up.
  await expect(page.getByTestId('signin-status')).toHaveText(
    /^(Signed out|Sign-in isn't set up)$/,
  );
});
