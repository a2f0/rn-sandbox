import { by, device, element, expect, waitFor } from 'detox';

describe('Sign-in', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('shows the sign-in bar', async () => {
    await waitFor(element(by.id('signin-status')))
      .toBeVisible()
      .withTimeout(60000);
    // Signed out once a Firebase project is provisioned, otherwise not set up.
    await expect(element(by.id('signin-signout'))).not.toExist();
  });
});
