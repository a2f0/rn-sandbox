import 'fake-indexeddb/auto';
import { fullSample } from '../src/roundTrip/fixtures';

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
  await first.cxx.withFiles(() =>
    first.cxx
      .cxx()
      .FS.writeFile(
        '/roundtrip/reload.json',
        new TextEncoder().encode(JSON.stringify(sample)),
      ),
  );

  const second = await loadModules();
  expect(second.cxx.cxx()).not.toBe(first.cxx.cxx());
  const restored = await second.roundTripCxx.readBytes('/roundtrip/reload.bin');
  expect(Array.from(new Uint8Array(restored))).toEqual(Array.from(bytes));
  const json = second.cxx.cxx().FS.readFile('/roundtrip/reload.json');
  expect(JSON.parse(new TextDecoder().decode(json))).toEqual(sample);
});

test('a tab loaded earlier keeps and sees files another tab saved', async () => {
  const earlier = await loadModules();
  const other = await loadModules();
  await other.roundTripCxx.writeBytes(
    '/roundtrip/other.bin',
    Uint8Array.of(1).buffer,
  );
  await earlier.roundTripCxx.writeBytes(
    '/roundtrip/earlier.bin',
    Uint8Array.of(2).buffer,
  );

  const bytesOf = async (modules: Modules, path: string) =>
    Array.from(new Uint8Array(await modules.roundTripCxx.readBytes(path)));
  expect(await bytesOf(earlier, '/roundtrip/other.bin')).toEqual([1]);
  const later = await loadModules();
  expect(await bytesOf(later, '/roundtrip/other.bin')).toEqual([1]);
  expect(await bytesOf(later, '/roundtrip/earlier.bin')).toEqual([2]);
});

test('overlapping writes from two tabs keep both files', async () => {
  const first = await loadModules();
  const second = await loadModules();
  // Hold the second tab's save back, so the first tab writes meanwhile.
  // Unless the lock makes the first tab wait, the second tab's save then
  // copies its files, which lack the first tab's, over IndexedDB.
  const { FS } = second.cxx.cxx();
  const syncfs = FS.syncfs.bind(FS);
  FS.syncfs = (populate: boolean, callback: (error: unknown) => void) =>
    populate
      ? syncfs(populate, callback)
      : setTimeout(() => syncfs(populate, callback), 100);

  const secondWrite = second.roundTrip.writeSample('second', fullSample);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const firstWrite = first.roundTripCxx.writeBytes(
    '/roundtrip/first.bin',
    Uint8Array.of(3).buffer,
  );
  await Promise.all([secondWrite, firstWrite]);

  const later = await loadModules();
  expect(
    Array.from(
      new Uint8Array(
        await later.roundTripCxx.readBytes('/roundtrip/first.bin'),
      ),
    ),
  ).toEqual([3]);
  await expect(later.roundTrip.readSample('second')).resolves.toEqual(
    fullSample,
  );
});

test('keeps files in memory without Web Locks', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(navigator, 'locks', {
    value: undefined,
    configurable: true,
  });
  try {
    const { cxx, filesDirectory, withFiles } = (await loadModules()).cxx;
    await withFiles(() =>
      cxx().FS.writeFile(`${filesDirectory}/unlocked.bin`, Uint8Array.of(5)),
    );
    expect(
      Array.from(cxx().FS.readFile(`${filesDirectory}/unlocked.bin`)),
    ).toEqual([5]);
    expect(warn).toHaveBeenCalledWith(
      'Web Locks are unavailable; files stay in memory.',
    );
  } finally {
    delete (navigator as { locks?: unknown }).locks;
    warn.mockRestore();
  }
  // Not saved, so a new load doesn't have it.
  const later = await loadModules();
  await expect(
    later.roundTripCxx.readBytes('/roundtrip/unlocked.bin'),
  ).rejects.toThrow('Could not read /roundtrip/unlocked.bin');
});

test('a deleted sample stays deleted after a new load', async () => {
  const first = await loadModules();
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
    const { cxx, filesDirectory, withFiles } = await loadModules().then(
      (modules) => modules.cxx,
    );
    const { FS } = cxx();
    await withFiles(() =>
      FS.writeFile(`${filesDirectory}/memory.bin`, Uint8Array.of(1, 2, 3)),
    );
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
