import { by, device, element, expect, waitFor } from 'detox';

describe('Bridge round trip', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('round-trips every case through the native modules', async () => {
    await waitFor(element(by.id('roundtrip-summary')))
      .toExist()
      .withTimeout(60000);
    await expect(element(by.id('roundtrip-status'))).toHaveText('passed');
  });

  it('expands and collapses a case when tapped', async () => {
    const row = 'roundtrip-case-sync-string';
    await expect(element(by.id(`${row}-description`))).not.toExist();
    await element(by.id(row)).tap();
    await expect(element(by.id(`${row}-description`))).toBeVisible();
    await element(by.id(row)).tap();
    await expect(element(by.id(`${row}-description`))).not.toExist();
  });
});
