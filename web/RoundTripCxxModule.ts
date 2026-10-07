import type { Spec } from '../specs/NativeRoundTripCxx';
import { cxx, persist } from './cxx';

// The web implementation of specs/NativeRoundTripCxx.ts: the same C++ as on
// iOS and Android (shared/RoundTripCxxCore.h), compiled to WebAssembly with
// the Embind bindings in web/wasm/RoundTripCxxWasm.cpp.

type Result<T> = { value: T } | { error: string };

function unwrap<T>(result: Result<T>): T {
  if ('error' in result) {
    throw new Error(result.error);
  }
  return result.value;
}

const RoundTripCxxModule: Spec = {
  echoArrayBuffer: (value) => unwrap(cxx().echoArrayBuffer(value)),
  echoMixed: (value) => unwrap(cxx().echoMixed(value)),

  // The C++ runs synchronously, since the browser gives it no threads; it
  // copies the bytes before returning, as it does natively. The promise
  // settles once the file is saved to IndexedDB.
  writeBytes: async (path, value) => {
    const written = unwrap<number>(cxx().writeBytes(path, value));
    await persist();
    return written;
  },
  readBytes: async (path) => unwrap(cxx().readBytes(path)),
};

export default RoundTripCxxModule;
