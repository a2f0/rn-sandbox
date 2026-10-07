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
// Orders file operations where the Web Locks API is missing (Jest).
let queue: Promise<unknown> = Promise.resolve();

function syncfs(module: MainModule, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) =>
    module.FS.syncfs(populate, (error: unknown) =>
      error ? reject(error) : resolve(),
    ),
  );
}

// Runs task while no other task, in this tab or another, holds the files.
function exclusively<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`files:${filesDirectory}`, task);
  }
  const run = queue.catch(() => {}).then(task);
  queue = run;
  return run;
}

// Loads the module and mounts filesDirectory from IndexedDB. Where
// IndexedDB is missing (Jest) or fails, files stay in memory. Call before
// anything uses cxx().
export function loadCxx(): Promise<MainModule> {
  loading ??= (async () => {
    const module = await createRoundTripCxx();
    module.FS.mkdirTree(filesDirectory, 0o777);
    if (typeof indexedDB !== 'undefined') {
      module.FS.mount(module.IDBFS, {}, filesDirectory);
      try {
        await exclusively(() => syncfs(module, true));
        persistent = true;
      } catch (error) {
        module.FS.unmount(filesDirectory);
        console.warn('IndexedDB is unavailable; files stay in memory.', error);
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
// holding a lock that the page's other tabs share. Saving copies this tab's
// whole file system to IndexedDB, so loading first keeps it from erasing
// files another tab saved meanwhile. Rejects if loading or saving fails.
export function withFiles<T>(operation: () => T): Promise<T> {
  const module = cxx();
  if (!persistent) {
    return exclusively(async () => operation());
  }
  return exclusively(async () => {
    await syncfs(module, true);
    const result = operation();
    await syncfs(module, false);
    return result;
  });
}
