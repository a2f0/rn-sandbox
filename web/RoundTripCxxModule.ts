import type { Spec } from '../specs/NativeRoundTripCxx';
import { cxx } from './cxx';

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
  // copies the bytes before returning, as it does natively.
  writeBytes: async (path, value) => unwrap(cxx().writeBytes(path, value)),
  readBytes: async (path) => unwrap(cxx().readBytes(path)),
};

export default RoundTripCxxModule;
