/// <reference lib="dom" />
import createRoundTripCxx, {
  type MainModule,
} from './wasm/build/roundTripCxx.js';

// The C++ TurboModule compiled to WebAssembly (scripts/buildWasm.sh). Both web
// modules keep their files in its Emscripten file system, as the native
// modules share the device's.

export const filesDirectory = '/roundtrip';

let loading: Promise<MainModule> | undefined;
let loaded: MainModule | undefined;
// Whether filesDirectory is saved to IndexedDB.
let persistent = false;

function syncfs(module: MainModule, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) =>
    module.FS.syncfs(populate, (error: unknown) =>
      error ? reject(error) : resolve(),
    ),
  );
}

// Runs task while no other task, in this tab or another of the site's,
// holds the saved files.
function exclusively<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(`files:${filesDirectory}`, task);
}

// Loads the module and mounts filesDirectory from IndexedDB. Files stay in
// memory where IndexedDB is missing (Jest by default) or fails, or where the
// Web Locks API that keeps tabs from erasing each other's files is missing.
// Call before anything uses cxx().
export function loadCxx(): Promise<MainModule> {
  loading ??= (async () => {
    const module = await createRoundTripCxx();
    module.FS.mkdirTree(filesDirectory, 0o777);
    if (typeof indexedDB !== 'undefined') {
      if (typeof navigator === 'undefined' || !navigator.locks) {
        console.warn('Web Locks are unavailable; files stay in memory.');
      } else {
        module.FS.mount(module.IDBFS, {}, filesDirectory);
        try {
          await exclusively(() => syncfs(module, true));
          persistent = true;
        } catch (error) {
          module.FS.unmount(filesDirectory);
          console.warn(
            'IndexedDB is unavailable; files stay in memory.',
            error,
          );
        }
      }
    }
    loaded = module;
    return module;
  })();
  return loading;
}

export function cxx(): MainModule {
  if (loaded === undefined) {
    throw new Error("The WebAssembly module isn't loaded; await loadCxx().");
  }
  return loaded;
}

// Runs a file operation on the latest saved files and saves its changes,
// holding a lock that the site's other tabs share. Saving copies this tab's
// whole file system to IndexedDB, so loading first keeps it from erasing
// files another tab saved meanwhile. Rejects if loading or saving fails.
export function withFiles<T>(operation: () => T): Promise<T> {
  const module = cxx();
  if (!persistent) {
    return Promise.resolve().then(operation);
  }
  return exclusively(async () => {
    await syncfs(module, true);
    const result = operation();
    await syncfs(module, false);
    return result;
  });
}

// IDBFS saves only files whose modification time changed, compared in
// milliseconds, so a write gives path a time later than its last one, even
// within the same millisecond. Writes run in withFiles, after the latest
// saved files load.
export function writeStamped<T>(path: string, write: () => T): T {
  const { FS } = cxx();
  const previous = FS.analyzePath(path, false).exists
    ? FS.stat(path, false).mtime.getTime()
    : 0;
  const result = write();
  const time = Math.max(Date.now(), previous + 1);
  FS.utime(path, time, time, false);
  return result;
}
