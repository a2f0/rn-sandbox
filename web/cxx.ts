import createRoundTripCxx, {
  type MainModule,
} from './wasm/build/roundTripCxx.js';

// The C++ TurboModule compiled to WebAssembly (scripts/buildWasm.sh). Both web
// modules keep their files in its Emscripten file system, as the native
// modules share the device's.

export const filesDirectory = '/roundtrip';

let loading: Promise<MainModule> | undefined;
let loaded: MainModule | undefined;

// Loads the module and mounts filesDirectory, saved to IndexedDB where the
// environment has it (Jest doesn't, so files there stay in memory). Call
// before anything uses cxx().
export function loadCxx(): Promise<MainModule> {
  loading ??= (async () => {
    const module = await createRoundTripCxx();
    module.FS.mkdirTree(filesDirectory, 0o777);
    if (typeof indexedDB !== 'undefined') {
      module.FS.mount(module.IDBFS, { autoPersist: true }, filesDirectory);
      await new Promise<void>((resolve, reject) =>
        module.FS.syncfs(true, (error: unknown) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
    loaded = module;
    return module;
  })();
  return loading;
}

export function cxx(): MainModule {
  if (loaded === undefined) {
    throw new Error('The WebAssembly module is loading; await loadCxx().');
  }
  return loaded;
}
