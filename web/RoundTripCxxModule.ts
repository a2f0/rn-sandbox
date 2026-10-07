import type { Spec } from '../specs/NativeRoundTripCxx';
import { readFile, writeFile } from './opfs';

// The web implementation of specs/NativeRoundTripCxx.ts.
const RoundTripCxxModule: Spec = {
  echoArrayBuffer: (value) => value.slice(0),
  echoMixed: (value) => structuredClone(value),

  writeBytes: async (path, value) => {
    await writeFile(path, new Uint8Array(value));
    return value.byteLength;
  },
  readBytes: async (path) => {
    const bytes = await readFile(path);
    if (bytes === null) {
      throw new Error(`Could not read ${path}`);
    }
    return bytes.slice().buffer;
  },
};

export default RoundTripCxxModule;
