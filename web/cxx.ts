import createRoundTripCxx, {
  type MainModule,
} from './wasm/build/roundTripCxx.js';

// The C++ TurboModule compiled to WebAssembly (scripts/buildWasm.sh). Both web
// modules keep their files in its Emscripten file system, as the native
// modules share the device's.

export const filesDirectory = '/roundtrip';

let loading: Promise<MainModule> | undefined;
let loaded: MainModule | undefined;
// Whether filesDirectory is saved to IndexedDB, and the save under way.
let persistent = false;
let saving: Promise<void> = Promise.resolve();

function syncfs(module: MainModule, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) =>
    module.FS.syncfs(populate, (error: unknown) =>
      error ? reject(error) : resolve(),
    ),
  );
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
        await syncfs(module, true);
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

// Saves filesDirectory to IndexedDB once any earlier save finishes, and
// rejects if this one fails. Writes and deletes await it before settling.
export function persist(): Promise<void> {
  if (!persistent) {
    return Promise.resolve();
  }
  const module = cxx();
  saving = saving.catch(() => {}).then(() => syncfs(module, false));
  return saving;
}
