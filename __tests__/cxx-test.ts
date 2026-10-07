// Loads web/cxx.ts in isolation, with IndexedDB replaced by a broken one.
test('keeps files in memory when IndexedDB fails', async () => {
  const global = globalThis as { indexedDB?: unknown };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.indexedDB = {
    open() {
      throw new Error('IndexedDB is unavailable');
    },
  };
  try {
    await jest.isolateModulesAsync(async () => {
      const { cxx, filesDirectory, loadCxx, persist } =
        require('../web/cxx') as typeof import('../web/cxx');
      await loadCxx();
      const { FS } = cxx();
      FS.writeFile(`${filesDirectory}/memory.bin`, Uint8Array.of(1, 2, 3));
      await persist();
      expect(Array.from(FS.readFile(`${filesDirectory}/memory.bin`))).toEqual([
        1, 2, 3,
      ]);
    });
    expect(warn).toHaveBeenCalledWith(
      'IndexedDB is unavailable; files stay in memory.',
      expect.any(Error),
    );
  } finally {
    delete global.indexedDB;
    warn.mockRestore();
  }
});
