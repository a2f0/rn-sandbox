describe('Example', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show world screen after tap', async () => {
    await expect(element(by.text('Step One'))).toBeVisible();
  });
});
