import type { Spec } from '../specs/NativeRoundTripCxx';
import { cxx, withFiles } from './cxx';

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

  // The C++ runs synchronously, since the browser gives it no threads, once
  // the files are free (web/cxx.ts). The bytes are copied at the call, as
  // the C++ module copies them natively.
  writeBytes: (path, value) => {
    const bytes = value.slice(0);
    return withFiles(() => unwrap<number>(cxx().writeBytes(path, bytes)));
  },
  readBytes: (path) =>
    withFiles(() => unwrap<ArrayBuffer>(cxx().readBytes(path))),
};

export default RoundTripCxxModule;
