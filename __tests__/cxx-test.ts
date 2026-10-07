import 'fake-indexeddb/auto';

type Cxx = typeof import('../web/cxx');
type Modules = {
  cxx: Cxx;
  roundTrip: typeof import('../web/RoundTripModule').default;
  roundTripCxx: typeof import('../web/RoundTripCxxModule').default;
};

// Loads the web modules afresh, as a page load does. fake-indexeddb's
// IndexedDB outlives the load, as the browser's does.
async function loadModules(): Promise<Modules> {
  let modules: Modules | undefined;
  await jest.isolateModulesAsync(async () => {
    const cxx = require('../web/cxx') as Cxx;
    await cxx.loadCxx();
    modules = {
      cxx,
      roundTrip: require('../web/RoundTripModule').default,
      roundTripCxx: require('../web/RoundTripCxxModule').default,
    };
  });
  if (modules === undefined) {
    throw new Error('The web modules did not load');
  }
  return modules;
}

test('a new load restores the files an earlier one saved', async () => {
  const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37 + 11) % 256);
  const sample = { text: 'saved', number: 4.5 };
  const first = await loadModules();
  await first.roundTripCxx.writeBytes('/roundtrip/reload.bin', bytes.buffer);
  await first.cxx.persist();
  first.cxx
    .cxx()
    .FS.writeFile(
      '/roundtrip/reload.json',
      new TextEncoder().encode(JSON.stringify(sample)),
    );
  await first.cxx.persist();

  const second = await loadModules();
  expect(second.cxx.cxx()).not.toBe(first.cxx.cxx());
  const restored = await second.roundTripCxx.readBytes('/roundtrip/reload.bin');
  expect(Array.from(new Uint8Array(restored))).toEqual(Array.from(bytes));
  const json = second.cxx.cxx().FS.readFile('/roundtrip/reload.json');
  expect(JSON.parse(new TextDecoder().decode(json))).toEqual(sample);
});

test('a deleted sample stays deleted after a new load', async () => {
  const first = await loadModules();
  const { fullSample } = require('../src/roundTrip/fixtures');
  await first.roundTrip.writeSample('removed', fullSample);
  expect(await first.roundTrip.deleteFile('removed')).toBe(true);

  const second = await loadModules();
  await expect(second.roundTrip.readSample('removed')).rejects.toMatchObject({
    code: 'E_NOT_FOUND',
  });
});

test('keeps files in memory when IndexedDB fails', async () => {
  const global = globalThis as { indexedDB?: unknown };
  const working = global.indexedDB;
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.indexedDB = {
    open() {
      throw new Error('IndexedDB is unavailable');
    },
  };
  try {
    const { cxx, filesDirectory, persist } = await loadModules().then(
      (modules) => modules.cxx,
    );
    const { FS } = cxx();
    FS.writeFile(`${filesDirectory}/memory.bin`, Uint8Array.of(1, 2, 3));
    await persist();
    expect(Array.from(FS.readFile(`${filesDirectory}/memory.bin`))).toEqual([
      1, 2, 3,
    ]);
    expect(warn).toHaveBeenCalledWith(
      'IndexedDB is unavailable; files stay in memory.',
      expect.any(Error),
    );
  } finally {
    global.indexedDB = working;
    warn.mockRestore();
  }
});
